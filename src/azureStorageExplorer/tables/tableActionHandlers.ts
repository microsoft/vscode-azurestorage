/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from 'vscode-azureextensionui';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { deleteNode } from '../commonTreeCommands';
import { TableTreeItem } from './tableNode';

export function registerTableActionHandlers(): void {
    registerCommand("azureStorage.openTable", openTableInStorageExplorer);
    registerCommand("azureStorage.deleteTable", async (treeItem?: TableTreeItem) => await deleteNode(TableTreeItem.contextValue, treeItem));
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
function openTableInStorageExplorer(treeItem: TableTreeItem): Promise<void> {
    let accountId = treeItem.root.storageAccount.id;
    const resourceType = "Azure.Table";
    let resourceName = treeItem.tableName;

    return storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
