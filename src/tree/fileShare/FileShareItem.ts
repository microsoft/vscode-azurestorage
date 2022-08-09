import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";

export class FileShareItem implements StorageAccountModel {
    constructor(private readonly shareName: string) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.shareName);

        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
        };

        return treeItem;
    }
}
