import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import * as vscode from 'vscode';
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

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(path.basename(this.directoryPath), vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureFileShareDirectory';
        treeItem.iconPath = new vscode.ThemeIcon('folder');

        return treeItem;
    }
}
