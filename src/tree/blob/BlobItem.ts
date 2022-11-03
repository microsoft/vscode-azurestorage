import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { createBlobClient } from '../../utils/blobUtils';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from "../StorageAccountModel";

export interface BlobItemContext {
    containerName: string;
    storageRoot: IStorageRoot;
}

export class BlobItem implements StorageAccountModel {
    constructor(
        public readonly blobPath: string,
        public readonly context: BlobItemContext) {
    }

    get copyUrl(): vscode.Uri {
        // Use this.blobPath here instead of this.blobName. Otherwise the blob's containing directory/directories aren't displayed
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(this.context.storageRoot, this.context.containerName, this.blobPath);

        return vscode.Uri.parse(blobClient.url);
    }

    public readonly name: string = path.basename(this.blobPath);

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.name);

        treeItem.contextValue = 'azureBlob';
        treeItem.iconPath = new vscode.ThemeIcon('file');

        return treeItem;
    }
}
