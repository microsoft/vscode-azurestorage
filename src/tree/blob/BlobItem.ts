import * as vscode from 'vscode';
import * as path from 'path';
import { StorageAccountModel } from "../StorageAccountModel";
import { IStorageRoot } from '../IStorageRoot';

export interface BlobItemContext {
    containerName: string;
    storageRoot: IStorageRoot;
}

export class BlobItem implements StorageAccountModel {
    constructor(
        public readonly blobPath: string,
        public readonly context: BlobItemContext) {
    }

    public readonly name: string = path.basename(this.blobPath);

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.name);

        treeItem.contextValue = 'azureBlob';
        treeItem.iconPath = new vscode.ThemeIcon('file');

        return treeItem;
    }
}
