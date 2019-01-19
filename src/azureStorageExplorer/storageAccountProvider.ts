/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import { AzureTreeItem, createAzureClient, createTreeItemsWithErrorHandling, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { StorageAccountWrapper } from '../components/storageWrappers';
import { StorageAccountTreeItem } from './storageAccounts/storageAccountNode';

export class StorageAccountProvider extends SubscriptionTreeItem {
    public childTypeLabel: string = "Storage Account";

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem[]> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);

        let accounts = await storageManagementClient.storageAccounts.list();
        return createTreeItemsWithErrorHandling(
            this,
            accounts,
            'invalidStorageAccount',
            async (sa: StorageAccount) => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
            (sa: StorageAccount) => {
                return sa.name;
            }
        );
    }

    hasMoreChildrenImpl(): boolean {
        return false;
    }
}
