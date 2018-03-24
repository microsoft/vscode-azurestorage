/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueueNode } from './queueNode';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export function registerQueueActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.openQueue", openQueueInStorageExplorer);
    actionHandler.registerCommand("azureStorage.deleteQueue", (node) => node.deleteNode());
}

function openQueueInStorageExplorer(node: IAzureNode<QueueNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;
    let subscriptionid = node.subscription.subscriptionId;
    const resourceType = "Azure.Queue";
    let resourceName = node.treeItem.queue.name;

    return storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}
