import * as azureStorageShare from '@azure/storage-file-share';
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath } from '../../constants';
import { FileParentItem, ShareDirectoryClientFactory } from './FileParentItem';
import { DirectoryItem } from './DirectoryItem';
import { StorageAccountModel } from '../StorageAccountModel';
import { GenericItem } from '../../utils/v2/treeutils';

export type ShareClientFactory = (shareName: string) => azureStorageShare.ShareClient;
export type StorageAccountInfo = { id: string, isEmulated: boolean, subscriptionId: string };

export class FileShareItem extends FileParentItem {
    constructor(
        shareDirectoryClientFactory: ShareDirectoryClientFactory,
        public readonly shareName: string,
        public readonly storageAccount: StorageAccountInfo) {

        super(
            /* directory: */ undefined,
            d => new DirectoryItem(d, shareDirectoryClientFactory),
            shareDirectoryClientFactory
        )
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const children = await super.getChildren();

        return [
            new GenericItem(
                () => {
                    const treeItem = new vscode.TreeItem('Open in File Explorer...');

                    treeItem.command = {
                        arguments: [ this ],
                        command: 'azureStorage.openInFileExplorer',
                        title: '' };
                    treeItem.contextValue = 'openInFileExplorer';

                    return treeItem;
                }),
            ...children
        ];
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

export type FileShareItemFactory = (shareName: string) => FileShareItem;

export function createFileShareItemFactory(shareClientFactory: ShareClientFactory, storageAccount: StorageAccountInfo): FileShareItemFactory {
    return (shareName: string) => {
        const directoryClientFactory = (directory: string) => shareClientFactory(shareName).getDirectoryClient(directory ?? '');

        return new FileShareItem(directoryClientFactory, shareName, storageAccount);
    }
}
