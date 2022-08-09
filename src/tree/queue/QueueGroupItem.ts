import * as azureStorageQueue from '@azure/storage-queue';
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath, maxPageSize } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";
import { QueueItem } from './QueueItem';

export class QueueGroupItem implements StorageAccountModel {
    constructor(private readonly queueServiceClientFactory: () => azureStorageQueue.QueueServiceClient) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const queues = await this.listAllQueues();

        return queues.map(queue => new QueueItem(queue));
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Queues', vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureQueueGroup';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureQueue.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureQueue.svg')
        };

        return treeItem;
    }

    private async listAllQueues(): Promise<azureStorageQueue.QueueItem[]> {
        let response: azureStorageQueue.ListQueuesSegmentResponse | undefined;

        const queues: azureStorageQueue.QueueItem[] = [];

        do {
            response = await this.listQueues(response?.continuationToken);

            if (response.queueItems) {
                queues.push(...response.queueItems);
            }
        } while (response.continuationToken);

        return queues;
    }

    private async listQueues(continuationToken?: string): Promise<azureStorageQueue.ListQueuesSegmentResponse> {
        const queueServiceClient = this.queueServiceClientFactory();
        const response: AsyncIterableIterator<azureStorageQueue.ServiceListQueuesSegmentResponse> = queueServiceClient.listQueues().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }
}
