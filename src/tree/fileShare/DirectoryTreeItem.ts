/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem, Uri, window } from 'vscode';
import { AzureParentTreeItem, DialogResponses, IActionContext, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { askAndCreateChildDirectory, deleteDirectoryAndContents, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { IFileShareCreateChildContext } from "./FileShareTreeItem";
import { FileTreeItem } from './FileTreeItem';

export class DirectoryTreeItem extends AzureParentTreeItem<IStorageRoot> implements ICopyUrl {
    constructor(
        parent: AzureParentTreeItem,
        public readonly parentPath: string,
        public readonly directory: azureStorage.FileService.DirectoryResult, // directory.name should not include parent path
        public readonly share: azureStorage.FileService.ShareResult) {
        super(parent);
    }

    private _continuationToken: azureStorage.common.ContinuationToken | undefined;
    public label: string = this.directory.name;
    public static contextValue: string = 'azureFileShareDirectory';
    public contextValue: string = DirectoryTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'folder.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'folder.svg')
    };

    private get fullPath(): string {
        return path.posix.join(this.parentPath, this.directory.name);
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<(DirectoryTreeItem | FileTreeItem)[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
        let fileResults = await this.listFiles(<azureStorage.common.ContinuationToken>this._continuationToken!);
        let { entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;

        return (<(DirectoryTreeItem | FileTreeItem)[]>[])
            .concat(entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
                return new DirectoryTreeItem(this, this.fullPath, directory, this.share);
            }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileTreeItem(this, file, this.fullPath, this.share);
            }));
    }

    public async copyUrl(): Promise<void> {
        let fileService = this.root.createFileService();
        let url = fileService.getUrl(this.share.name, this.fullPath);
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Directory URL copied to clipboard: ${url}`);
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return listFilesInDirectory(this.fullPath, this.share.name, this.root, currentToken);
    }

    public async createChildImpl(context: ICreateChildImplContext & IFileShareCreateChildContext): Promise<FileTreeItem | DirectoryTreeItem> {
        if (context.childType === FileTreeItem.contextValue) {
            return askAndCreateEmptyTextFile(this, this.fullPath, this.share, context);
        } else {
            return askAndCreateChildDirectory(this, this.fullPath, this.share, context);
        }
    }

    public async deleteTreeItemImpl(context: IActionContext & IDirectoryDeleteContext): Promise<void> {
        let result: MessageItem | undefined;
        if (!context.suppressMessage) {
            // Note: Azure will fail the directory delete if it's not empty, so no need to ask about deleting contents
            const message: string = `Are you sure you want to delete the directory '${this.label}' and all of its files and subdirectories?`;
            result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        } else {
            result = DialogResponses.deleteResponse;
        }

        if (result === DialogResponses.deleteResponse) {
            ext.outputChannel.show();
            await deleteDirectoryAndContents(this.fullPath, this.share.name, this.root);
        } else {
            throw new UserCancelledError();
        }
    }
}

export interface IDirectoryDeleteContext extends IActionContext {
    suppressMessage?: boolean;
}
