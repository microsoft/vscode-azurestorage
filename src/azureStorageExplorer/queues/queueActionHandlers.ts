/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from 'vscode-azureextensionui';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { deleteNode } from '../commonTreeCommands';
import { QueueTreeItem } from './queueNode';

export function registerQueueActionHandlers(): void {
    registerCommand("azureStorage.openQueue", openQueueInStorageExplorer);
    registerCommand("azureStorage.deleteQueue", async (treeItem?: QueueTreeItem) => await deleteNode(QueueTreeItem.contextValue, treeItem));
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
function openQueueInStorageExplorer(treeItem: QueueTreeItem): Promise<void> {
    let accountId = treeItem.root.storageAccount.id;
    const resourceType = "Azure.Queue";
    let resourceName = treeItem.queue.name;

    return storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
