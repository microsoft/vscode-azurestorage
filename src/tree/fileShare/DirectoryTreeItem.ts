/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem, Uri, window } from 'vscode';
import { AzureParentTreeItem, DialogResponses, IActionContext, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { askAndCreateChildDirectory, deleteDirectoryAndContents, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile, createDirectoryClient } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { IFileShareCreateChildContext } from "./FileShareTreeItem";
import { FileTreeItem } from './FileTreeItem';

export class DirectoryTreeItem extends AzureParentTreeItem<IStorageRoot> implements ICopyUrl {
    constructor(
        parent: AzureParentTreeItem,
        public readonly parentPath: string,
        public readonly directoryName: string, // directoryName should not include parent path
        public readonly shareName: string) {
        super(parent);
    }

    private _continuationToken: string | undefined;
    public label: string = this.directoryName;
    public static contextValue: string = 'azureFileShareDirectory';
    public contextValue: string = DirectoryTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'folder.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'folder.svg')
    };

    private get fullPath(): string {
        return path.posix.join(this.parentPath, this.directoryName);
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<(DirectoryTreeItem | FileTreeItem)[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let { files, directories, continuationToken }: { files: azureStorageShare.FileItem[]; directories: azureStorageShare.DirectoryItem[]; continuationToken: string; } = await this.listFiles(this._continuationToken);
        this._continuationToken = continuationToken;

        return (<(DirectoryTreeItem | FileTreeItem)[]>[])
            .concat(files.map((file: azureStorageShare.FileItem) => {
                return new FileTreeItem(this, file.name, this.fullPath, this.shareName);
            }))
            .concat(directories.map((directory: azureStorageShare.DirectoryItem) => {
                return new DirectoryTreeItem(this, this.fullPath, directory.name, this.shareName);
            }));
    }

    public async copyUrl(): Promise<void> {
        // Use this.fullPath here instead of this.directoryName. Otherwise only the leaf directory is displayed in the URL
        let directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(this.root, this.shareName, this.fullPath);

        // URLs for nested directories aren't automatically decoded properly
        const url = decodeURIComponent(directoryClient.url);

        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Directory URL copied to clipboard: ${url}`);
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFiles(currentToken: string | undefined): Promise<{ files: azureStorageShare.FileItem[], directories: azureStorageShare.DirectoryItem[], continuationToken: string }> {
        return listFilesInDirectory(this.fullPath, this.shareName, this.root, currentToken);
    }

    public async createChildImpl(context: ICreateChildImplContext & IFileShareCreateChildContext): Promise<FileTreeItem | DirectoryTreeItem> {
        if (context.childType === FileTreeItem.contextValue) {
            return askAndCreateEmptyTextFile(this, this.fullPath, this.shareName, context);
        } else {
            return askAndCreateChildDirectory(this, this.fullPath, this.shareName, context);
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
            await deleteDirectoryAndContents(this.fullPath, this.shareName, this.root);
        } else {
            throw new UserCancelledError();
        }
    }
}

export interface IDirectoryDeleteContext extends IActionContext {
    suppressMessage?: boolean;
}
