/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableNode } from './tableNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export function RegisterTableActionHandlers(actionHandler: AzureActionHandler) {
    actionHandler.registerCommand("azureStorage.openTable", (node) => openTableInStorageExplorer(node));
}

function openTableInStorageExplorer(node: IAzureNode<TableNode>) {
    var resourceId = node.treeItem.storageAccount.id;
    var subscriptionid = node.subscription.subscriptionId;
    var resourceType = "Azure.Table";
    var resourceName = node.treeItem.tableName;

    StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
}
