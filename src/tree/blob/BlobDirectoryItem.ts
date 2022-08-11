import * as azureStorageBlob from "@azure/storage-blob";
import * as vscode from 'vscode';
import * as path from 'path';
import { BlobParentItem } from './BlobParentItem';

export class BlobDirectoryItem extends BlobParentItem {
    private readonly dirPath: string;

    constructor(
        blobContainerClientFactory: () => azureStorageBlob.ContainerClient,
        isEmulated: boolean,
        dirPath: string) {
        if (!dirPath.endsWith(path.posix.sep)) {
            dirPath += path.posix.sep;
        }

        super(
            blobContainerClientFactory,
            (dirPath: string) => new BlobDirectoryItem(blobContainerClientFactory, isEmulated, dirPath),
            isEmulated,
            dirPath);

        this.dirPath = dirPath;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(path.basename(this.dirPath), vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureBlobDirectory';
        treeItem.iconPath = new vscode.ThemeIcon('folder');

        return treeItem;
    }
}
