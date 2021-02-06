/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { QueueTreeItem } from '../../tree/queue/QueueTreeItem';
import { deleteNode } from '../commonTreeCommands';

export function registerQueueActionHandlers(): void {
    registerCommand("azureStorage.openQueue", openQueueInStorageExplorer);
    registerCommand("azureStorage.deleteQueue", async (context: IActionContext, treeItem?: QueueTreeItem) => await deleteNode(context, QueueTreeItem.contextValue, treeItem));
}

async function openQueueInStorageExplorer(_context: IActionContext, treeItem: QueueTreeItem): Promise<void> {
    const accountId = treeItem.root.storageAccountId;
    const resourceType = "Azure.Queue";
    const resourceName = treeItem.queue.name;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
