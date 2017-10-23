/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../AzureServiceExplorer/Nodes/AzureTreeNodeBase';
import { AzureTreeDataProvider } from '../../AzureServiceExplorer/AzureTreeDataProvider';
import { AzureBlobNode } from './AzureBlobNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';

export class AzureBlobContainerNode extends AzureTreeNodeBase {
    constructor(
		public readonly container: azureStorage.BlobService.ContainerResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super(container.name, treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'azureBlobContainerNode',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
			}
        }
    }

    async getChildren(): Promise<any> {
        var blobs = await this.listBlobs(null);
        var {entries /*, continuationToken*/} = blobs;
        
        return entries.map((blob: azureStorage.BlobService.BlobResult) => {
            return new AzureBlobNode(blob, this.container, this.storageAccount, this.key, this.getTreeDataProvider(), this);
        });
    }

    listBlobs(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.BlobService.ListBlobsResult> {
        return new Promise(resolve => {
            var blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
			blobService.listBlobsSegmented(this.container.name, currentToken, {maxResults: 5}, (_err, result: azureStorage.BlobService.ListBlobsResult) => {
				resolve(result);
			})
		});
    }
}
