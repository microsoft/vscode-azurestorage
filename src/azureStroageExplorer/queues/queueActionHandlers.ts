/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueueNode } from './queueNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export function RegisterQueueActionHandlers(actionHandler: AzureActionHandler) {
    actionHandler.registerCommand("azureStorage.openQueue", (node) => { openQueueInStorageExplorer(node) });
    actionHandler.registerCommand("azureStorage.deleteQueue", (node) => node.deleteNode());
}

function openQueueInStorageExplorer(node: IAzureNode<QueueNode>) {
    var resourceId = node.treeItem.storageAccount.id;
    var subscriptionid = node.subscription.subscriptionId;
    var resourceType = "Azure.Queue";
    var resourceName = node.treeItem.queue.name;

    StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
}
