/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import StorageManagementClient = require('azure-arm-storage');
import { StorageAccount } from '../../node_modules/azure-arm-storage/lib/models';
import { IChildProvider, IAzureTreeItem, IAzureNode } from 'vscode-azureextensionui';
import { StorageAccountNode } from './storageAccounts/storageAccountNode';
import { Subscription } from 'azure-arm-resource/lib/subscription/models';

export class StorageAccountProvider implements IChildProvider { 
    async loadMoreChildren(node: IAzureNode, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        const subscription: Subscription = node.subscription;
        var storageManagementClient = new StorageManagementClient(node.credentials, subscription.subscriptionId);

        var accounts = await storageManagementClient.storageAccounts.list();
        var accountNodes = accounts.map((storageAccount: StorageAccount) => {
            return new StorageAccountNode(subscription, storageAccount, storageManagementClient);
        })

        return accountNodes;
    }

    hasMoreChildren(): boolean {
        return false;
    }
}