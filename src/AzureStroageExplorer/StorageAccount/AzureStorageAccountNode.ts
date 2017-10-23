/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import StorageManagementClient = require('azure-arm-storage');
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { AccountManager } from '../../AzureServiceExplorer/AccountManager';
import { SubscriptionModels } from 'azure-arm-resource';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../AzureServiceExplorer/Nodes/AzureTreeNodeBase';
import { AzureTreeDataProvider } from '../../AzureServiceExplorer/AzureTreeDataProvider';
import { AzureBlobContainerGroupNode } from '../BlobContainers/AzureBlobContainerGroupNode';
import { AzureFileShareGroupNode } from '../FileShares/AzureFileShareGroupNode';
import { AzureTableGroupNode } from '../Tables/AzureTableGroupNode';
import { AzureQueueGroupNode } from '../Queues/AzureQueueGroupNode';
import * as path from 'path';

export class AzureStorageAccountNode extends AzureTreeNodeBase {
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
            contextValue: 'azureStorageAccountNode',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureStorageAccount_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureStorageAccount_16x.png')
			}
        }
    }

    async getChildren(): Promise<AzureTreeNodeBase[]> {
        var keys: StorageAccountKey[] = await this.getKeys();
        var primaryKey = keys.find((key: StorageAccountKey) => {
            return key.keyName === "key1";
        });
        
		return [
            new AzureBlobContainerGroupNode(this.storageAccount, primaryKey, this.getTreeDataProvider(), this),
            new AzureFileShareGroupNode(this.storageAccount, primaryKey, this.getTreeDataProvider(), this),
            new AzureTableGroupNode(this.storageAccount, primaryKey, this.getTreeDataProvider(), this),
            new AzureQueueGroupNode(this.storageAccount, primaryKey, this.getTreeDataProvider(), this)
        ];
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
