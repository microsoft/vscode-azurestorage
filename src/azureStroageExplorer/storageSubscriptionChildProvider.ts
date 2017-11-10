/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import StorageManagementClient = require('azure-arm-storage');
import { StorageAccount } from '../../node_modules/azure-arm-storage/lib/models';
import { ISubscriptionChildrenProvider } from "../azureServiceExplorer/ISubscriptionChildrenProvider";
import { StorageAccountNode } from './storageAccounts/storageAccountNode';
import { AccountManager } from '../azureServiceExplorer/accountManager';
import { SubscriptionModels } from 'azure-arm-resource';
import { AzureTreeNodeBase } from '../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../azureServiceExplorer/azureTreeDataProvider';

export class StorageSubscriptionChildProvider implements ISubscriptionChildrenProvider {
    async getChildren(azureAccountWrapper: AccountManager, subscription: SubscriptionModels.Subscription, treeDataProvider: AzureTreeDataProvider, subscriptionNode): Promise<AzureTreeNodeBase[]> {
        const credentials = azureAccountWrapper.getCredentialByTenantId(subscription.tenantId);
        var storageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);

        var accounts = await storageManagementClient.storageAccounts.list();
        var accountNodes = accounts.map((storageAccount: StorageAccount) => {
            return new StorageAccountNode(azureAccountWrapper, subscription, storageAccount, treeDataProvider, subscriptionNode, storageManagementClient);
        })

        return accountNodes;
    }
}