import * as azureStorageQueue from '@azure/storage-queue';
import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath } from '../../constants';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from "../StorageAccountModel";

export class QueueItem implements StorageAccountModel {
    constructor(
        private readonly queue: azureStorageQueue.QueueItem,
        public readonly storageRoot: IStorageRoot,
        public readonly subscriptionId: string,
        public readonly notifyDeleted: () => void) {
    }

    readonly id?: string;

    public get name(): string {
        return this.queue.name;
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.name);

        treeItem.contextValue = 'azureQueue';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureQueue.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureQueue.svg')
        };

        return treeItem;
    }
}
