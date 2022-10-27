/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogResponses, IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { QueueItem } from '../../tree/queue/QueueItem';
import { registerBranchCommand } from '../../utils/v2/commandUtils';

export function registerQueueActionHandlers(): void {
    registerBranchCommand("azureStorage.openQueue", openQueueInStorageExplorer);
    registerBranchCommand("azureStorage.deleteQueue", deleteQueue);
}

async function openQueueInStorageExplorer(_context: IActionContext, treeItem: QueueItem): Promise<void> {
    const accountId = treeItem.storageRoot.storageAccountId;
    const resourceType = "Azure.Queue";
    const resourceName = treeItem.name;

    await storageExplorerLauncher.openResource(accountId, treeItem.subscriptionId, resourceType, resourceName);
}

export async function deleteQueue(context: IActionContext, treeItem?: QueueItem): Promise<void> {
    // TODO: Implement pick.
    // treeItem = await pickForDeleteNode(context, QueueTreeItem.contextValue, treeItem);

    if (!treeItem) {
        throw new Error('A tree item must be selected.');
    }

    const message: string = `Are you sure you want to delete queue '${treeItem.name}' and all its contents?`;
    const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    if (result === DialogResponses.deleteResponse) {
        const queueServiceClient = treeItem.storageRoot.createQueueServiceClient();
        await queueServiceClient.deleteQueue(treeItem.name);
        treeItem.notifyDeleted();
    } else {
        throw new UserCancelledError();
    }
}
