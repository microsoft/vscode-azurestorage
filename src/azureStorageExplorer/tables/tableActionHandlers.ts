/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableNode } from './tableNode';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export function registerTableActionHandlers(actionHandler: AzureActionHandler) {
    actionHandler.registerCommand("azureStorage.openTable", openTableInStorageExplorer);
    actionHandler.registerCommand("azureStorage.deleteTable", (node) => node.deleteNode());
}

function openTableInStorageExplorer(node: IAzureNode<TableNode>) {
    let resourceId = node.treeItem.storageAccount.id;
    let subscriptionid = node.subscription.subscriptionId;
    let resourceType = "Azure.Table";
    let resourceName = node.treeItem.tableName;

    storageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
}
