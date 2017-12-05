/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { BlobContainerNode } from './blobContainerNode';
import { SubscriptionModels } from 'azure-arm-resource';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { AzureLoadMoreTreeNodeBase } from '../../azureServiceExplorer/nodes/azureLoadMoreTreeNodeBase';

export class BlobContainerGroupNode extends AzureLoadMoreTreeNodeBase {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly subscription: SubscriptionModels.Subscription, 
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
            contextValue: 'azureBlobContainerGroup',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
			}
        }
    }

    async getMoreChildren(): Promise<AzureTreeNodeBase[]> {
        var containers = await this.listContainers(this._continuationToken);
        var {entries , continuationToken} = containers;
        this._continuationToken = continuationToken;

        return entries.map((container: azureStorage.BlobService.ContainerResult) => {
            return new BlobContainerNode(this.subscription, container, this.storageAccount, this.key, this.treeDataProvider, this);
        });
    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    listContainers(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.BlobService.ListContainerResult> {
        return new Promise(resolve => {
            var blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
			blobService.listContainersSegmented(currentToken, {maxResults: 50}, (_err, result: azureStorage.BlobService.ListContainerResult) => {
				resolve(result);
			})
		});
    }
}
