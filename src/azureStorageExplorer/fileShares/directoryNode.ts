/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as copypaste from 'copy-paste';
import * as path from 'path';
import { Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from "../../components/storageWrappers";
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { askAndCreateChildDirectory, deleteDirectoryAndContents, listFilesInDirectory } from './directoryUtils';
import { FileTreeItem } from './fileNode';
import { askAndCreateEmptyTextFile } from './fileUtils';

export class DirectoryTreeItem extends AzureParentTreeItem implements ICopyUrl {
    constructor(
        parent: AzureParentTreeItem,
        public readonly parentPath: string,
        public readonly directory: azureStorage.FileService.DirectoryResult, // directory.name should not include parent path
        public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly key: StorageAccountKeyWrapper) {
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

    async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
        let fileResults = await this.listFiles(<azureStorage.common.ContinuationToken>this._continuationToken!);
        let { entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;

        return (<AzureTreeItem[]>[])
            .concat(entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
                return new DirectoryTreeItem(this, this.fullPath, directory, this.share, this.storageAccount, this.key);
            }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileTreeItem(this, file, this.fullPath, this.share, this.storageAccount, this.key);
            }));
    }

    public async copyUrl(): Promise<void> {
        let fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
        let url = fileService.getUrl(this.share.name, this.fullPath);
        copypaste.copy(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Directory URL copied to clipboard: ${url}`);
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFiles(currentToken: azureStorage.common.ContinuationToken | undefined): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return listFilesInDirectory(this.fullPath, this.share.name, this.storageAccount.name, this.key.value, 50, currentToken);
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, userOptions?: {}): Promise<AzureTreeItem> {
        if (userOptions === FileTreeItem.contextValue) {
            return askAndCreateEmptyTextFile(this, this.fullPath, this.share, this.storageAccount, this.key, showCreatingTreeItem);
        } else {
            return askAndCreateChildDirectory(this, this.fullPath, this.share, this.storageAccount, this.key, showCreatingTreeItem);
        }
    }

    public async deleteTreeItemImpl(): Promise<void> {
        // Note: Azure will fail the directory delete if it's not empty, so no need to ask about deleting contents
        const message: string = `Are you sure you want to delete the directory '${this.label}' and all of its files and subdirectories?`;
        const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            ext.outputChannel.show();
            await deleteDirectoryAndContents(this.fullPath, this.share.name, this.storageAccount.name, this.key.value);
        } else {
            throw new UserCancelledError();
        }
    }
}
