import * as azureStorageQueue from '@azure/storage-queue';
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath, maxPageSize } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";
import { QueueItem } from './QueueItem';
import { IStorageRoot } from '../IStorageRoot';
import { localize } from "../../utils/localize";
import { GenericItem } from '../../utils/v2/treeutils';
import { parseError } from '@microsoft/vscode-azext-utils';

export class QueueGroupItem implements StorageAccountModel {
    constructor(
        private readonly storageRoot: IStorageRoot,
        private readonly refresh?: (model: StorageAccountModel) => void) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        let queues: azureStorageQueue.QueueItem[];

        try {
            queues = await this.listAllQueues();
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (this.storageRoot.isEmulated && errorType === 'ECONNREFUSED') {
                return [
                    // TODO: Exclude from tree item picker.
                    new GenericItem(
                        () => {
                            const treeItem = new vscode.TreeItem('Start Queue Emulator');

                            treeItem.contextValue = 'startQueueEmulator';
                            treeItem.command = {
                                arguments: [
                                    () => {
                                        this.refresh?.(this);
                                    }
                                ],
                                command: 'azureStorage.startQueueEmulator',
                                title: ''
                            };

                            return treeItem;
                        })
                ];
            } else if (errorType === 'ENOTFOUND') {
                throw new Error(localize('storageAccountDoesNotSupportQueues', 'This storage account does not support queues.'));
            } else {
                throw error;
            }
        }

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
        const queueServiceClient = this.storageRoot.createQueueServiceClient();
        const response: AsyncIterableIterator<azureStorageQueue.ServiceListQueuesSegmentResponse> = queueServiceClient.listQueues().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }
}

export type QueueGroupItemFactory = (storageRoot: IStorageRoot) => QueueGroupItem;

export function createQueueGroupItemFactory(refresh: (model: StorageAccountModel) => void): QueueGroupItemFactory {
    return storageRoot => new QueueGroupItem(storageRoot, refresh);
}
