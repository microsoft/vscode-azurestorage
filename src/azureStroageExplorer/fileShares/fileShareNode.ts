/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { SubscriptionModels } from 'azure-arm-resource';
/*
import { FileNode } from './fileNode';
import { DirectoryNode } from './directoryNode';
*/
import * as azureStorage from "azure-storage";
import * as path from 'path';

export class FileShareNode extends AzureTreeNodeBase {
    constructor(
        public readonly subscription: SubscriptionModels.Subscription, 
		public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super(share.name, treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: 'azureFileShare',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureFileShare_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureFileShare_16x.png')
			}
        }
    }

    async getChildren(): Promise<any> {
        return [];
    }

    /*
    async getChildren(): Promise<any> {
        var fileResults = await this.listFiles(null);
        var {entries} = fileResults;

        return []
        .concat( entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
            return new DirectoryNode('', directory, this.share, this.storageAccount, this.key, this.getTreeDataProvider(), this);
        }))
        .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
            return new FileNode(file, this.share, this.storageAccount, this.key, this.getTreeDataProvider(), this);
        }));
    }

    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise(resolve => {
            var fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            fileService.listFilesAndDirectoriesSegmented(this.share.name, '', currentToken, {maxResults: 5}, (_err, result: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
				resolve(result);
			})
		});
    }
    */
}
