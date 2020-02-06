/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { ProgressLocation, Uri, window } from 'vscode';
import { AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { QueueTreeItem } from './QueueTreeItem';

export class QueueGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    public label: string = "Queues";
    public readonly childTypeLabel: string = "Queue";
    public static contextValue: string = 'azureQueueGroup';
    public contextValue: string = QueueGroupTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureQueue.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureQueue.svg')
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
            queueService.listQueuesSegmented(currentToken, { maxResults: maxPageSize }, (err?: Error, result?: azureStorage.QueueService.ListQueueResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<QueueTreeItem> {
        const queueName = await ext.ui.showInputBox({
            placeHolder: 'Enter a name for the new queue',
            validateInput: QueueGroupTreeItem.validateQueueName
        });

        if (queueName) {
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                context.showCreatingTreeItem(queueName);
                progress.report({ message: `Azure Storage: Creating queue '${queueName}'` });
                const share = await this.createQueue(queueName);
                return new QueueTreeItem(this, share);
            });
        }

        throw new UserCancelledError();
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === QueueTreeItem.contextValue;
    }

    private async createQueue(name: string): Promise<azureStorage.QueueService.QueueResult> {
        return new Promise((resolve, reject) => {
            let queueService = this.root.createQueueService();
            queueService.createQueue(name, (err?: Error, result?: azureStorage.QueueService.QueueResult, response?: azureStorage.ServiceResponse) => {
                if (err) {
                    reject(err);
                } else if (response && response.statusCode === 204) {
                    // When a queue with the specified name already exists, the Queue service checks
                    // the metadata associated with the existing queue. If the existing metadata is
                    // identical to the metadata specified on the Create Queue request, status code
                    // 204 (No Content) is returned.
                    // Source: https://msdn.microsoft.com/en-us/library/azure/dd179342.aspx
                    reject(new Error('The queue specified already exists.'));
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
