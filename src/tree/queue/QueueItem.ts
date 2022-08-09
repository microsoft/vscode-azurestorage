import * as azureStorageQueue from '@azure/storage-queue';
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";

export class QueueItem implements StorageAccountModel {
    constructor(private readonly queue: azureStorageQueue.QueueItem) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.queue.name);

        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureQueue.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureQueue.svg')
        };

        return treeItem;
    }
}
