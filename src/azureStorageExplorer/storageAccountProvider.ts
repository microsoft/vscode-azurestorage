/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from 'azure-arm-storage';
import { AzureTreeItem, createAzureClient, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { StorageAccount } from '../../node_modules/azure-arm-storage/lib/models';
import { StorageAccountWrapper } from '../components/storageWrappers';
import { StorageAccountTreeItem } from './storageAccounts/storageAccountNode';

export class StorageAccountProvider extends SubscriptionTreeItem {
    public childTypeLabel: string = "Storage Account";

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem[]> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);

        let accounts = await storageManagementClient.storageAccounts.list();
        let accountTreeItems = accounts.map((storageAccount: StorageAccount) => {
            return new StorageAccountTreeItem(this, new StorageAccountWrapper(storageAccount), storageManagementClient);
        });

        return accountTreeItems;
    }

    hasMoreChildrenImpl(): boolean {
        return false;
    }
}
