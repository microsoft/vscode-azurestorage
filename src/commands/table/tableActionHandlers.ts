/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { TableTreeItem } from '../../tree/table/TableTreeItem';
import { deleteNode } from '../commonTreeCommands';

export function registerTableActionHandlers(): void {
    registerCommand("azureStorage.openTable", openTableInStorageExplorer);
    registerCommand("azureStorage.deleteTable", async (context: IActionContext, treeItem?: TableTreeItem) => await deleteNode(context, TableTreeItem.contextValue, treeItem));
}

async function openTableInStorageExplorer(_context: IActionContext, treeItem: TableTreeItem): Promise<void> {
    let accountId = treeItem.root.storageAccount.id;
    const resourceType = "Azure.Table";
    let resourceName = treeItem.tableName;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
