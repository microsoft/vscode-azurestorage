/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import StorageManagementClient = require('azure-arm-storage');
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { AccountManager } from '../../azureServiceExplorer/accountManager';
import { SubscriptionModels } from 'azure-arm-resource';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { BlobContainerGroupNode } from '../blobContainers/blobContainerGroupNode';
import { FileShareGroupNode } from '../fileShares/fileShareGroupNode';
import { TableGroupNode } from '../tables/tableGroupNode';
import { QueueGroupNode } from '../queues/queueGroupNode';
import * as path from 'path';

export class StorageAccountNode extends AzureTreeNodeBase {
    constructor(
		public readonly accountManager: AccountManager, 
		public readonly subscription: SubscriptionModels.Subscription, 
		public readonly storageAccount: StorageAccount, 
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase,
        public readonly storageManagementClient: StorageManagementClient) {
		super(storageAccount.name, treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'azureStorageAccount',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureStorageAccount_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureStorageAccount_16x.png')
			}
        }
    }

    async getChildren(): Promise<AzureTreeNodeBase[]> {
        var primaryKey = await this.getPrimaryKey();
        var primaryEndpoints = this.storageAccount.primaryEndpoints;
        var groupNodes = [];

        if (!!primaryEndpoints.blob) {
            groupNodes.push(new BlobContainerGroupNode(this.subscription, this.storageAccount, primaryKey, this.treeDataProvider, this));
        }

        if (!!primaryEndpoints.file) {
            groupNodes.push(new FileShareGroupNode(this.subscription, this.storageAccount, primaryKey, this.treeDataProvider, this));
        }

        if (!!primaryEndpoints.queue) {
            groupNodes.push(new QueueGroupNode(this.subscription, this.storageAccount, primaryKey, this.treeDataProvider, this));
        }

        if(!!primaryEndpoints.table) {
            groupNodes.push(new TableGroupNode(this.subscription, this.storageAccount, primaryKey, this.treeDataProvider, this));
        }

        return groupNodes;
    }

    async getPrimaryKey() : Promise<string> {
        var keys: StorageAccountKey[] = await this.getKeys();
        var primaryKey = keys.find((key: StorageAccountKey) => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        return primaryKey.value;
    }

    async getConnectionString() {
        var primaryKey = await this.getPrimaryKey();
        return "DefaultEndpointsProtocol=https;AccountName=" + this.storageAccount.name + ";AccountKey=" + primaryKey;
    }

    async getKeys() {
        var parsedId = this.parseAzureResourceId(this.storageAccount.id);
        var resourceGroupName = parsedId["resourceGroups"];
        var keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);  
        return keyResult.keys;
    }

    parseAzureResourceId(resourceId: string): { [key: string]: string } {
        const invalidIdErr = new Error('Invalid Account ID.');
        const result = {};
    
        if (!resourceId || resourceId.length < 2 || resourceId.charAt(0) !== '/') {
            throw invalidIdErr;
        }
    
        const parts = resourceId.substring(1).split('/');
    
        if (parts.length % 2 !== 0) {
            throw invalidIdErr;
        }
    
        for (let i = 0; i < parts.length; i += 2) {
            const key = parts[i];
            const value = parts[i + 1];
    
            if (key === '' || value === '') {
                throw invalidIdErr;
            }
    
            result[key] = value;
        }
    
        return result;
    }
}
