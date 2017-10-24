/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { QueueNode } from './queueNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';

export class QueueGroupNode extends AzureTreeNodeBase {
    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super("Queues", treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'azureQueueGroupNode',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureQueue_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureQueue_16x.png')
			}
        }
    }

    async getChildren(): Promise<any> {
        var containers = await this.listQueues(null);
        var {entries /*, continuationToken*/} = containers;

        return entries.map((queue: azureStorage.QueueService.QueueResult) => {
            return new QueueNode(
                queue, this.storageAccount, this.key, this.getTreeDataProvider(), this);
        });

    }

    listQueues(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.QueueService.ListQueueResult> {
        return new Promise(resolve => {
            var queueService = azureStorage.createQueueService(this.storageAccount.name, this.key.value);
			queueService.listQueuesSegmented(currentToken, {maxResults: 5}, (_err, result: azureStorage.QueueService.ListQueueResult) => {
				resolve(result);
			})
		});
    }
}
