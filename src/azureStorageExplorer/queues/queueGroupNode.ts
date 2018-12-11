/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { ProgressLocation, Uri, window } from 'vscode';
import { AzureParentTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { IStorageRoot } from "../IStorageRoot";
import { QueueTreeItem } from './queueNode';

export class QueueGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    public label: string = "Queues";
    public readonly childTypeLabel: string = "Queue";
    public static contextValue: string = 'azureQueueGroup';
    public contextValue: string = QueueGroupTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureQueue.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureQueue.svg')
    };

    async loadMoreChildrenImpl(clearCache: boolean): Promise<QueueTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // currentToken argument typed incorrectly in SDK
        let containers = await this.listQueues(<azureStorage.common.ContinuationToken>this._continuationToken);
        let { entries, continuationToken } = containers;
        this._continuationToken = continuationToken;

        return entries.map((queue: azureStorage.QueueService.QueueResult) => {
            return new QueueTreeItem(
                this,
                queue);
        });

    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listQueues(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.QueueService.ListQueueResult> {
        return new Promise((resolve, reject) => {
            let queueService = this.root.createQueueService();
            queueService.listQueuesSegmented(currentToken, { maxResults: 50 }, (err?: Error, result?: azureStorage.QueueService.ListQueueResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void): Promise<QueueTreeItem> {
        const queueName = await window.showInputBox({
            placeHolder: 'Enter a name for the new queue',
            validateInput: QueueGroupTreeItem.validateQueueName
        });

        if (queueName) {
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                showCreatingTreeItem(queueName);
                progress.report({ message: `Azure Storage: Creating queue '${queueName}'` });
                const share = await this.createQueue(queueName);
                return new QueueTreeItem(this, share);
            });
        }

        throw new UserCancelledError();
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private createQueue(name: string): Promise<azureStorage.QueueService.QueueResult> {
        return new Promise((resolve, reject) => {
            let queueService = this.root.createQueueService();
            queueService.createQueue(name, (err?: Error, result?: azureStorage.QueueService.QueueResult) => {
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
