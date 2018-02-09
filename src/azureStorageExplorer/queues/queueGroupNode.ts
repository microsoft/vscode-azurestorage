/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, ProgressLocation, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { QueueNode } from './queueNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';

import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';

export class QueueGroupNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public label: string = "Queues";
    public contextValue: string = 'azureQueueGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureQueue_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureQueue_16x.png')
    };

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        var containers = await this.listQueues(this._continuationToken);
        var { entries, continuationToken } = containers;
        this._continuationToken = continuationToken;

        return entries.map((queue: azureStorage.QueueService.QueueResult) => {
            return new QueueNode(
                queue,
                this.storageAccount,
                this.key);
        });

    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    listQueues(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.QueueService.ListQueueResult> {
        return new Promise((resolve, reject) => {
            var queueService = azureStorage.createQueueService(this.storageAccount.name, this.key.value);
            queueService.listQueuesSegmented(currentToken, { maxResults: 50 }, (err: Error, result: azureStorage.QueueService.ListQueueResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        });
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const queueName = await window.showInputBox({
            placeHolder: 'Enter a name for the new queue',
            validateInput: QueueGroupNode.validateQueueName
        });

        if (queueName) {
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                showCreatingNode(queueName);
                progress.report({ message: `Azure Storage: Creating queue '${queueName}'` });
                const share = await this.createQueue(queueName);
                return new QueueNode(share, this.storageAccount, this.key);
            });
        }

        throw new UserCancelledError();
    }

    private createQueue(name: string): Promise<azureStorage.QueueService.QueueResult> {
        return new Promise((resolve, reject) => {
            var queueService = azureStorage.createQueueService(this.storageAccount.name, this.key.value);
            queueService.createQueue(name, (err: Error, result: azureStorage.QueueService.QueueResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private static validateQueueName(name: string): string | undefined | null {
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
}
