/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableNode } from './tableNode';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export function registerTableActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.openTable", openTableInStorageExplorer);
    actionHandler.registerCommand("azureStorage.deleteTable", (node) => node.deleteNode());
}

function openTableInStorageExplorer(node: IAzureNode<TableNode>): Promise<void> {
    var resourceId = node.treeItem.storageAccount.id;
    var subscriptionid = node.subscription.subscriptionId;
    var resourceType = "Azure.Table";
    var resourceName = node.treeItem.tableName;

    return storageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
}
