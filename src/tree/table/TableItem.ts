import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";

export class TableItem implements StorageAccountModel {
    constructor(private readonly tableName: string) {
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
