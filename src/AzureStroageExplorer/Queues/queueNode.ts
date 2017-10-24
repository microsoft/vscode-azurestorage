/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { MessageNode } from './messageNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';

export class QueueNode extends AzureTreeNodeBase {
    constructor(
		public readonly queue: azureStorage.QueueService.QueueResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super(queue.name, treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'azureQueueNode',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureQueue_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureQueue_16x.png')
			}
        }
    }

    async getChildren(): Promise<any> {
        var messages = await this.listMessages();
        
        return messages.map((message: azureStorage.QueueService.QueueMessageResult) => {
            return new MessageNode(message, this.queue, this.storageAccount, this.key, this.getTreeDataProvider(), this);
        });
    }

    listMessages(): Promise<azureStorage.QueueService.QueueMessageResult[]> {
        return new Promise(resolve => {
            var queueService = azureStorage.createQueueService(this.storageAccount.name, this.key.value);
			queueService.peekMessages(this.queue.name, (_err, result: azureStorage.QueueService.QueueMessageResult[]) => {
				resolve(result);
			})
		});
    }
}
