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
    let accountId = node.treeItem.storageAccount.id;
    let subscriptionid = node.subscription.subscriptionId;
    const resourceType = "Azure.Table";
    let resourceName = node.treeItem.tableName;

    return storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}
