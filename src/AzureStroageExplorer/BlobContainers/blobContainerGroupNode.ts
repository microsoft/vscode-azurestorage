/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { BlobContainerNode } from './blobContainerNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';

export class BlobContainerGroupNode extends AzureTreeNodeBase {
    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super("Blob Containers", treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'azureBlobContainerGroupNode',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
			}
        }
    }

    async getChildren(): Promise<any> {
        var containers = await this.listContainers(null);
        var {entries /*, continuationToken*/} = containers;

        return entries.map((container: azureStorage.BlobService.ContainerResult) => {
            return new BlobContainerNode(
                container, this.storageAccount, this.key, this.getTreeDataProvider(), this);
        });

    }

    listContainers(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.BlobService.ListContainerResult> {
        return new Promise(resolve => {
            var blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
			blobService.listContainersSegmented(currentToken, {maxResults: 5}, (_err, result: azureStorage.BlobService.ListContainerResult) => {
				resolve(result);
			})
		});
    }
}
