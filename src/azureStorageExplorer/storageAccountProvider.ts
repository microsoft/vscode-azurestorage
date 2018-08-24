/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from 'azure-arm-storage';
import { IAzureNode, IAzureTreeItem, IChildProvider } from 'vscode-azureextensionui';
import { StorageAccount } from '../../node_modules/azure-arm-storage/lib/models';
import { StorageAccountWrapper } from '../components/storageWrappers';
import { StorageAccountNode } from './storageAccounts/storageAccountNode';

export class StorageAccountProvider implements IChildProvider {
    public childTypeLabel: string = "Storage Account";

    async loadMoreChildren(node: IAzureNode, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        let storageManagementClient = new StorageManagementClient(node.credentials, node.subscriptionId, node.environment.resourceManagerEndpointUrl);

        let accounts = await storageManagementClient.storageAccounts.list();
        let accountNodes = accounts.map((storageAccount: StorageAccount) => {
            return new StorageAccountNode(new StorageAccountWrapper(storageAccount), storageManagementClient);
        });

        return accountNodes;
    }

    hasMoreChildren(): boolean {
        return false;
    }
}
