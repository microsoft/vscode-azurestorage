/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { FileNode } from './fileNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureParentTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { askAndCreateChildDirectory, listFilesInDirectory, deleteDirectoryAndContents } from './directoryUtils';
import { DialogOptions } from '../../azureServiceExplorer/messageItems/dialogOptions';
import { askAndCreateEmptyTextFile } from './fileUtils';
import { azureStorageOutputChannel } from '../azureStorageOutputChannel';

export class DirectoryNode implements IAzureParentTreeItem {
    constructor(
        public readonly parentPath: string,
        public readonly directory: azureStorage.FileService.DirectoryResult, // directory.name should not include parent path
        public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {

    }

    private _continuationToken: azureStorage.common.ContinuationToken;
    public label: string = this.directory.name;
    public static contextValue: string = 'azureFileShareDirectory';
    public contextValue: string = DirectoryNode.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'folder.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'folder.svg')
    };

    private get fullPath(): string {
        return path.posix.join(this.parentPath, this.directory.name);
    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let fileResults = await this.listFiles(this._continuationToken);
        let { entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;

        return []
            .concat(entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
                return new DirectoryNode(this.fullPath, directory, this.share, this.storageAccount, this.key);
            }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileNode(file, this.fullPath, this.share, this.storageAccount, this.key);
            }));
    }

    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return listFilesInDirectory(this.fullPath, this.share.name, this.storageAccount.name, this.key.value, 50, currentToken);
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void, userOptions?: any): Promise<IAzureTreeItem> {
        if (userOptions === FileNode.contextValue) {
            return askAndCreateEmptyTextFile(this.fullPath, this.share, this.storageAccount, this.key, showCreatingNode);
        } else {
            return askAndCreateChildDirectory(this.fullPath, this.share, this.storageAccount, this.key, showCreatingNode);
        }
    }

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        // Note: Azure will fail the directory delete if it's not empty, so no need to ask about deleting contents
        const message: string = `Are you sure you want to delete the directory '${this.label}' and all of its files and subdirectories?`;
        const result = await window.showWarningMessage(message, DialogOptions.yes, DialogOptions.cancel);
        if (result === DialogOptions.yes) {
            azureStorageOutputChannel.show();
            await deleteDirectoryAndContents(this.fullPath, this.share.name, this.storageAccount.name, this.key.value, azureStorageOutputChannel);
        } else {
            throw new UserCancelledError();
        }
    }
}
