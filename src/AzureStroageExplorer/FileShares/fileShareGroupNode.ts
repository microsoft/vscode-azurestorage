/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { FileShareNode } from './fileShareNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';

export class FileShareGroupNode extends AzureTreeNodeBase {
    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super("File Shares", treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'azureFileShareGroupNode',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureFileShare_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureFileShare_16x.png')
			}
        }
    }

    async getChildren(): Promise<any> {
        var fileShares = await this.listFileShares(null);
        var {entries /*, continuationToken*/} = fileShares;

        return entries.map((fileShare: azureStorage.FileService.ShareResult) => {
            return new FileShareNode(
                fileShare, this.storageAccount, this.key, this.getTreeDataProvider(), this);
        });

    }

    listFileShares(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListSharesResult> {
        return new Promise(resolve => {
            var fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
			fileService.listSharesSegmented(currentToken, {maxResults: 5}, (_err, result: azureStorage.FileService.ListSharesResult) => {
				resolve(result);
			})
		});
    }
}
