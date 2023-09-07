/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommandWithTreeNodeUnwrapping } from '@microsoft/vscode-azext-utils';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { TableTreeItem } from '../../tree/table/TableTreeItem';
import { deleteNode } from '../commonTreeCommands';

export function registerTableActionHandlers(): void {
    registerCommandWithTreeNodeUnwrapping("azureStorage.openTable", openTableInStorageExplorer);
    registerCommandWithTreeNodeUnwrapping("azureStorage.deleteTable", deleteTable);
}

async function openTableInStorageExplorer(_context: IActionContext, treeItem: TableTreeItem): Promise<void> {
    const accountId = treeItem.root.storageAccountId;
    const resourceType = "Azure.Table";
    const resourceName = treeItem.tableName;

    await storageExplorerLauncher.openResource(accountId, treeItem.subscription.subscriptionId, resourceType, resourceName);
}

export async function deleteTable(context: IActionContext, treeItem?: TableTreeItem): Promise<void> {
    await deleteNode(context, TableTreeItem.contextValue, treeItem);
}
