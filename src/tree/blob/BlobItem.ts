import * as vscode from 'vscode';
import * as path from 'path';
import { StorageAccountModel } from "../StorageAccountModel";

export class BlobItem implements StorageAccountModel {
    constructor(private readonly blobPath: string) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(path.basename(this.blobPath));

        treeItem.contextValue = 'azureBlob';
        treeItem.iconPath = new vscode.ThemeIcon('file');

        return treeItem;
    }
}
