import * as azureStorageShare from '@azure/storage-file-share';
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath } from '../../constants';
import { FileParentItem } from './FileParentItem';
import { DirectoryItem } from './DirectoryItem';

export class FileShareItem extends FileParentItem {
    constructor(
        directoryClientFactory: (directory: string | undefined) => azureStorageShare.ShareDirectoryClient,
        private readonly shareName: string) {
        super(
            /* directory: */ undefined,
            d => new DirectoryItem(d, directoryClientFactory),
            directoryClientFactory
        )
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.shareName, vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureFileShare';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
        };

        return treeItem;
    }
}
