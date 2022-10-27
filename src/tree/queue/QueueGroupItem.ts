import * as azureStorageQueue from '@azure/storage-queue';
import { parseError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath } from '../../constants';
import { delay } from '../../utils/delay';
import { localize } from "../../utils/localize";
import { GenericItem } from '../../utils/v2/treeutils';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from "../StorageAccountModel";
import { QueueItem } from './QueueItem';
import { listAllQueues } from './queueUtils';

export class QueueGroupItem implements StorageAccountModel {
    constructor(
        public readonly storageRoot: IStorageRoot,
        private readonly subscriptionId: string,
        private readonly refresh: (model: StorageAccountModel) => void) {
    }

    readonly id?: string;

    readonly notifyCreated = (): void => this.refresh?.(this);

    async getChildren(): Promise<StorageAccountModel[]> {
        let queues: azureStorageQueue.QueueItem[] | undefined;

        const tries = 3;

        for (let i = 0; i < tries; i++) {
            queues = await this.getQueues();

            if (queues) {
                break;
            } else {
                await delay(500);
            }
        }

        if (queues) {
            return queues.map(queue => new QueueItem(queue, this.storageRoot, this.subscriptionId, () => this.refresh(this)));
        } else {
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
        }
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

    private async getQueues(): Promise<azureStorageQueue.QueueItem[] | undefined> {
        try {
            return await listAllQueues(this.storageRoot);
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (this.storageRoot.isEmulated && errorType === 'ECONNREFUSED') {
                return undefined;
            } else if (errorType === 'ENOTFOUND') {
                throw new Error(localize('storageAccountDoesNotSupportQueues', 'This storage account does not support queues.'));
            } else {
                throw error;
            }
        }
    }
}

export type QueueGroupItemFactory = (storageRoot: IStorageRoot, subscriptionId: string) => QueueGroupItem;

export function createQueueGroupItemFactory(refresh: (model: StorageAccountModel) => void): QueueGroupItemFactory {
    return (storageRoot, subscriptionId) => new QueueGroupItem(storageRoot, subscriptionId, refresh);
}
