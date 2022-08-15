import * as vscode from 'vscode';
import * as path from 'path';
import { StorageAccountModel } from '../StorageAccountModel';

export class FileItem implements StorageAccountModel {
    constructor(
        private readonly path: string) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(path.basename(this.path));

        treeItem.contextValue = 'azureFile';
        treeItem.iconPath = new vscode.ThemeIcon('file');

        return treeItem;
    }
}
