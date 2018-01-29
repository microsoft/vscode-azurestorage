/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { StorageAccountNode } from './storageAccountNode';
import * as copypaste from 'copy-paste';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export class StorageAccountActionHandler extends AzureActionHandler {
    registerActions() {
        this.registerCommand("azureStorage.openStorageAccount", (node) => { this.openStorageAccountInStorageExplorer(node) });
        this.registerCommand("azureStorage.copyPrimaryKey", (node) => { this.copyPrimaryKey(node) });
        this.registerCommand("azureStorage.copyConnectionString", (node) => { this.copyConnectionString(node) });
    }

    openStorageAccountInStorageExplorer(node: IAzureNode<StorageAccountNode>) {
        var resourceId = node.treeItem.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid);
    }

    async copyPrimaryKey(node: IAzureNode<StorageAccountNode>) {
        var primaryKey = await node.treeItem.getPrimaryKey();
        copypaste.copy(primaryKey.value);
    }

    async copyConnectionString(node: IAzureNode<StorageAccountNode>) {
        var connectionString = await node.treeItem.getConnectionString();
        copypaste.copy(connectionString);
    }
}
