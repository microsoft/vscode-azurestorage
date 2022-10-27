import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath } from '../../constants';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from "../StorageAccountModel";

export class TableItem implements StorageAccountModel {
    constructor(
        public readonly tableName: string,
        public readonly storageRoot: IStorageRoot,
        public readonly subscriptionId: string,
        public readonly notifyDeleted: () => void) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.tableName);

        treeItem.contextValue = 'azureTable';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureTable.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureTable.svg')
        };

        return treeItem;
    }
}
