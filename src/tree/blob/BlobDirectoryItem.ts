import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { createBlobClient } from '../../utils/blobUtils';
import { IStorageRoot } from '../IStorageRoot';
import { BlobParentItem } from './BlobParentItem';

export class BlobDirectoryItem extends BlobParentItem {
    constructor(
        blobContainerClientFactory: () => azureStorageBlob.ContainerClient,
        private readonly containerName: string,
        isEmulated: boolean,
        dirPath: string,
        storageRoot: IStorageRoot) {
        super(
            blobContainerClientFactory,
            (dirPath: string) => new BlobDirectoryItem(blobContainerClientFactory, containerName, isEmulated, dirPath, storageRoot),
            isEmulated,
            dirPath,
            storageRoot);

        if (!dirPath.endsWith(path.posix.sep)) {
            dirPath += path.posix.sep;
        }

        this.dirPath = dirPath;
        this.dirName = path.basename(this.dirPath);
    }

    get copyUrl(): vscode.Uri {
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(this.storageRoot, this.containerName, this.dirPath);

        return vscode.Uri.parse(blobClient.url);
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
