/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { DirectoryNode } from './directoryNode';
import { FileNode } from './fileNode';
import { IAzureTreeItem, IAzureParentTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { DialogOptions } from '../../azureServiceExplorer/messageItems/dialogOptions';
import { askAndCreateChildDirectory } from './directoryUtils';
import { askAndCreateEmptyTextFile } from './fileUtils';

export class FileShareNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public label: string = this.share.name;
    public contextValue: string = 'azureFileShare';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureFileShare_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureFileShare_16x.png')
    };

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
                return new DirectoryNode('', directory, this.share, this.storageAccount, this.key);
            }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileNode(file, '', this.share, this.storageAccount, this.key);
            }));
    }

    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise((resolve, reject) => {
            let fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            fileService.listFilesAndDirectoriesSegmented(this.share.name, '', currentToken, { maxResults: 50 }, (err: Error, result: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete file share '${this.label}' and all its contents?`;
        const result = await window.showWarningMessage(message, DialogOptions.yes, DialogOptions.cancel);
        if (result === DialogOptions.yes) {
            const fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            await new Promise((resolve, reject) => {
                fileService.deleteShare(this.share.name, err => {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void, userOptions: any): Promise<IAzureTreeItem> {
        if (userOptions === FileNode.contextValue) {
            return askAndCreateEmptyTextFile('', this.share, this.storageAccount, this.key, showCreatingNode);
        } else {
            return askAndCreateChildDirectory('', this.share, this.storageAccount, this.key, showCreatingNode);
        }
    }
}
