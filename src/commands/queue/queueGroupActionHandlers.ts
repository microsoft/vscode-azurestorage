/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageQueue from '@azure/storage-queue';
import { IActionContext, registerCommand, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { QueueGroupItem } from '../../tree/queue/QueueGroupItem';
import { listQueues } from '../../tree/queue/queueUtils';
import { isAzuriteInstalled, warnAzuriteNotInstalled } from '../../utils/azuriteUtils';
import { localize } from "../../utils/localize";
import { WrappedResourceModel } from '../../utils/v2/WrappedResourceModel';

export function registerQueueGroupActionHandlers(): void {
    registerCommand("azureStorage.createQueue", createQueue);
}

function validateQueueName(name: string): string | undefined | null {
    const validLength = { min: 3, max: 63 };

    if (!name) {
        return "Queue name cannot be empty";
    }
    if (name.indexOf(" ") >= 0) {
        return "Queue name cannot contain spaces";
    }
    if (name.length < validLength.min || name.length > validLength.max) {
        return `Queue name must contain between ${validLength.min} and ${validLength.max} characters`;
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
        return 'Queue name can only contain lowercase letters, numbers and hyphens';
    }
    if (/--/.test(name)) {
        return 'Queue name cannot contain two hyphens in a row';
    }
    if (/(^-)|(-$)/.test(name)) {
        return 'Queue name cannot begin or end with a hyphen';
    }

    return undefined;
}

export async function createQueue(context: IActionContext, treeItem?: WrappedResourceModel): Promise<void> {
    const queueGroupItem = treeItem?.unwrap<QueueGroupItem>();

    if (!queueGroupItem) {
        throw new Error('A tree item must be selected.');
    }

    if (queueGroupItem.storageRoot.isEmulated && !(await isAzuriteInstalled())) {
        warnAzuriteNotInstalled(context);
    }

    const queueName = await context.ui.showInputBox({
        placeHolder: 'Enter a name for the new queue',
        validateInput: validateQueueName
    });

    if (queueName) {
        return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            progress.report({ message: `Azure Storage: Creating queue '${queueName}'` });
            const queueServiceClient = queueGroupItem.storageRoot.createQueueServiceClient();
            await queueServiceClient.createQueue(queueName);

            const queuesResponse: azureStorageQueue.ListQueuesSegmentResponse = await listQueues(queueGroupItem.storageRoot);
            let createdQueue: azureStorageQueue.QueueItem | undefined;
            for (const queue of queuesResponse.queueItems || []) {
                if (queue.name === queueName) {
                    createdQueue = queue;
                    break;
                }
            }

            if (!createdQueue) {
                throw new Error(localize('couldNotCreateQueue', `Could not create queue "${queueName}".`));
            }

            queueGroupItem.notifyCreated();
        });
    }

    throw new UserCancelledError();
}
