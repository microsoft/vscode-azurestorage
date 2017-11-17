/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from '../../azureServiceExplorer/actions/baseActionHandler';

import { QueueNode } from './queueNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';

export class QueueActionHandler extends BaseActionHandler {
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.openQueue", (node) => { this.openQueueInStorageExplorer(node) });
    }

    openQueueInStorageExplorer(node: QueueNode) {
        var resourceId = node.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        var resourceType = "Azure.Queue";
        var resourceName = node.queue.name;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
    }
}
