/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from 'vscode-azureextensionui';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { QueueTreeItem } from './queueNode';

export function registerQueueActionHandlers(): void {
    registerCommand("azureStorage.openQueue", openQueueInStorageExplorer);
    registerCommand("azureStorage.deleteQueue", async (treeItem: QueueTreeItem) => await treeItem.deleteTreeItem());
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
function openQueueInStorageExplorer(treeItem: QueueTreeItem): Promise<void> {
    let accountId = treeItem.storageAccount.id;
    const resourceType = "Azure.Queue";
    let resourceName = treeItem.queue.name;

    return storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
