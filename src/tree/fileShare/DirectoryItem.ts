import * as azureStorageShare from '@azure/storage-file-share';
import * as vscode from 'vscode';
import * as path from 'path';
import { FileParentItem } from './FileParentItem';

export class DirectoryItem extends FileParentItem {
    constructor(
        private readonly directoryPath: string,
        directoryClientFactory: (directory: string | undefined) => azureStorageShare.ShareDirectoryClient) {
        super(
            directoryPath,
            d => new DirectoryItem(d, directoryClientFactory),
            directoryClientFactory);
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(path.basename(this.directoryPath), vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureFileShareDirectory';
        treeItem.iconPath = new vscode.ThemeIcon('folder');

        return treeItem;
    }
}
