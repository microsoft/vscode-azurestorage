/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as clipboardy from 'clipboardy';
import * as path from 'path';
import { Uri, window } from 'vscode';
import { AzureParentTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { askAndCreateChildDirectory, deleteDirectoryAndContents, listFilesInDirectory } from './directoryUtils';
import { FileTreeItem } from './fileNode';
import { askAndCreateEmptyTextFile } from './fileUtils';

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
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'folder.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'folder.svg')
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
        await clipboardy.write(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Directory URL copied to clipboard: ${url}`);
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFiles(currentToken: azureStorage.common.ContinuationToken | undefined): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return listFilesInDirectory(this.fullPath, this.share.name, this.root, 50, currentToken);
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, userOptions?: {}): Promise<FileTreeItem | DirectoryTreeItem> {
        if (userOptions === FileTreeItem.contextValue) {
            return askAndCreateEmptyTextFile(this, this.fullPath, this.share, showCreatingTreeItem);
        } else {
            return askAndCreateChildDirectory(this, this.fullPath, this.share, showCreatingTreeItem);
        }
    }

    public async deleteTreeItemImpl(): Promise<void> {
        // Note: Azure will fail the directory delete if it's not empty, so no need to ask about deleting contents
        const message: string = `Are you sure you want to delete the directory '${this.label}' and all of its files and subdirectories?`;
        const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            ext.outputChannel.show();
            await deleteDirectoryAndContents(this.fullPath, this.share.name, this.root);
        } else {
            throw new UserCancelledError();
        }
    }
}
