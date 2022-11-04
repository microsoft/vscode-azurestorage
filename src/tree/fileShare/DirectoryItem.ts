import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import * as vscode from 'vscode';
import { createDirectoryClient } from '../../utils/fileUtils';
import { IStorageRoot } from '../IStorageRoot';
import { FileParentItem } from './FileParentItem';

export class DirectoryItem extends FileParentItem {
    constructor(
        private readonly directoryPath: string,
        shareName: string,
        storageRoot: IStorageRoot,
        directoryClientFactory: (directory: string | undefined) => azureStorageShare.ShareDirectoryClient) {
        super(
            directoryPath,
            shareName,
            d => new DirectoryItem(d, shareName, storageRoot, directoryClientFactory),
            directoryClientFactory,
            storageRoot);
    }

    get copyUrl(): vscode.Uri {
        // Use this.fullPath here instead of this.directoryName. Otherwise only the leaf directory is displayed in the URL
        const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(this.storageRoot, this.shareName, this.directoryPath);

        return vscode.Uri.parse(directoryClient.url);
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(path.basename(this.directoryPath), vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureFileShareDirectory';
        treeItem.iconPath = new vscode.ThemeIcon('folder');

        return treeItem;
    }
}
