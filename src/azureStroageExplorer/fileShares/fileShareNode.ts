/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { SubscriptionModels } from 'azure-arm-resource';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { DirectoryNode } from './directoryNode';
import { FileNode } from './fileNode';
import { IAzureTreeItem, IAzureParentTreeItem } from 'vscode-azureextensionui';

export class FileShareNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly subscription: SubscriptionModels.Subscription, 
		public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {		
    }
    public id: string = this.share.name;
    public label: string = this.share.name;
    public contextValue: string = 'azureFileShare';
    public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };
    
    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildren(): Promise<IAzureTreeItem[]> {
        var fileResults = await this.listFiles(this._continuationToken);
        var {entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;
        return []
        .concat( entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
            return new DirectoryNode('', directory, this.share, this.storageAccount, this.key);
        }))
        .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
            return new FileNode(file, '', this.share, this.storageAccount, this.key);
        }));
    }

    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise(resolve => {
            var fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            fileService.listFilesAndDirectoriesSegmented(this.share.name, '', currentToken, {maxResults: 50}, (_err, result: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
				resolve(result);
			})
		});
    }
}
