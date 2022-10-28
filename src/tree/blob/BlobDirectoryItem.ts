import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { IStorageRoot } from '../IStorageRoot';
import { BlobParentItem } from './BlobParentItem';

export class BlobDirectoryItem extends BlobParentItem {
    constructor(
        blobContainerClientFactory: () => azureStorageBlob.ContainerClient,
        isEmulated: boolean,
        dirPath: string,
        storageRoot: IStorageRoot) {
        if (!dirPath.endsWith(path.posix.sep)) {
            dirPath += path.posix.sep;
        }

        super(
            blobContainerClientFactory,
            (dirPath: string) => new BlobDirectoryItem(blobContainerClientFactory, isEmulated, dirPath, storageRoot),
            isEmulated,
            dirPath,
            storageRoot);

        this.dirPath = dirPath;
        this.dirName = path.basename(this.dirPath);
    }

    public readonly dirName: string;
    public readonly dirPath: string;

    async getTreeItem(): Promise<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.dirName, vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureBlobDirectory';
        treeItem.iconPath = new vscode.ThemeIcon('folder');

        return treeItem;
    }
}
