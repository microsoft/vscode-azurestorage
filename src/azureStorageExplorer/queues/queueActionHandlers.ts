/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureNode } from 'vscode-azureextensionui';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { QueueNode } from './queueNode';

export function registerQueueActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.openQueue", openQueueInStorageExplorer);
    actionHandler.registerCommand("azureStorage.deleteQueue", async (node: IAzureNode<QueueNode>) => await node.deleteNode());
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
function openQueueInStorageExplorer(node: IAzureNode<QueueNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;
    const resourceType = "Azure.Queue";
    let resourceName = node.treeItem.queue.name;

    return storageExplorerLauncher.openResource(accountId, node.subscriptionId, resourceType, resourceName);
}
