/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { QueueNode } from './queueNode';
import { SubscriptionModels } from 'azure-arm-resource';
import * as azureStorage from "azure-storage";
import * as path from 'path';

import { IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';

export class QueueGroupNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly subscription: SubscriptionModels.Subscription, 
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {		
    }

    public id: string = "Queues";
    public label: string = "Queues";
    public contextValue: string = 'azureQueueGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureQueue_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureQueue_16x.png')
    };

    async loadMoreChildren(): Promise<IAzureTreeItem[]> {
        var containers = await this.listQueues(this._continuationToken);
        var {entries, continuationToken} = containers;
        this._continuationToken = continuationToken;

        return entries.map((queue: azureStorage.QueueService.QueueResult) => {
            return new QueueNode(
                this.subscription,
                queue, 
                this.storageAccount, 
                this.key);
        });

    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    listQueues(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.QueueService.ListQueueResult> {
        return new Promise(resolve => {
            var queueService = azureStorage.createQueueService(this.storageAccount.name, this.key.value);
			queueService.listQueuesSegmented(currentToken, {maxResults: 50}, (_err, result: azureStorage.QueueService.ListQueueResult) => {
				resolve(result);
			})
		});
    }
}
