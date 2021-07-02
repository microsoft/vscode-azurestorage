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
    registerCommand("azureStorage.deleteTable", deleteTable);
}

async function openTableInStorageExplorer(_context: IActionContext, treeItem: TableTreeItem): Promise<void> {
    const accountId = treeItem.root.storageAccountId;
    const resourceType = "Azure.Table";
    const resourceName = treeItem.tableName;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}

export async function deleteTable(context: IActionContext, treeItem?: TableTreeItem): Promise<void> {
    await deleteNode(context, TableTreeItem.contextValue, treeItem);
}
