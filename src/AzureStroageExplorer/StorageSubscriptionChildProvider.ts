import StorageManagementClient = require('azure-arm-storage');
import { StorageAccount } from '../../node_modules/azure-arm-storage/lib/models';
import { ISubscriptionChildrenProvider } from "../AzureServiceExplorer/ISubscriptionChildrenProvider";
import { AzureStorageAccountNode } from './StorageAccount/AzureStorageAccountNode';
import { AccountManager } from '../AzureServiceExplorer/AccountManager';
import { SubscriptionModels } from 'azure-arm-resource';
import { AzureTreeNodeBase } from '../AzureServiceExplorer/Nodes/AzureTreeNodeBase';
import { AzureTreeDataProvider } from '../AzureServiceExplorer/AzureTreeDataProvider';

export class StorageSubscriptionChildProvider implements ISubscriptionChildrenProvider {
    async getChildren(azureAccountWrapper: AccountManager, subscription: SubscriptionModels.Subscription, treeDataProvider: AzureTreeDataProvider, subscriptionNode): Promise<AzureTreeNodeBase[]> {
        const credentials = azureAccountWrapper.getCredentialByTenantId(subscription.tenantId);
        var storageManagementClient = new StorageManagementClient(credentials, subscription.subscriptionId);

        var accounts = await storageManagementClient.storageAccounts.list();
        var accountNodes = accounts.map((storageAccount: StorageAccount) => {
            return new AzureStorageAccountNode(azureAccountWrapper, subscription, storageAccount, treeDataProvider, subscriptionNode, storageManagementClient);
        })

        return accountNodes;
    }
}