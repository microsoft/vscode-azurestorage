import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath } from '../../constants';
import { createShareClient } from '../../utils/fileUtils';
import { GenericItem } from '../../utils/v2/treeutils';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from '../StorageAccountModel';
import { DirectoryItem } from './DirectoryItem';
import { FileParentItem, ShareDirectoryClientFactory } from './FileParentItem';

export type ShareClientFactory = (shareName: string) => azureStorageShare.ShareClient;
export type StorageAccountInfo = { id: string, isEmulated: boolean, subscriptionId: string };

export class FileShareItem extends FileParentItem {
    constructor(
        shareDirectoryClientFactory: ShareDirectoryClientFactory,
        shareName: string,
        public readonly storageAccount: StorageAccountInfo,
        storageRoot: IStorageRoot,
        public readonly notifyDeleted: () => void) {

        super(
            /* directory: */ undefined,
            shareName,
            d => new DirectoryItem(d, shareName, storageRoot, shareDirectoryClientFactory),
            shareDirectoryClientFactory,
            storageRoot
        )
    }

    get copyUrl(): vscode.Uri {
        const shareClient: azureStorageShare.ShareClient = createShareClient(this.storageRoot, this.shareName);

        return vscode.Uri.parse(shareClient.url);
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const children = await super.getChildren();

        return [
            new GenericItem(
                () => {
                    const treeItem = new vscode.TreeItem('Open in File Explorer...');

                    treeItem.command = {
                        arguments: [this],
                        command: 'azureStorage.openInFileExplorer',
                        title: ''
                    };
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

export type FileShareItemFactory = (shareName: string, notifyDeleted: () => void) => FileShareItem;

export function createFileShareItemFactory(shareClientFactory: ShareClientFactory, storageAccount: StorageAccountInfo, storageRoot: IStorageRoot): FileShareItemFactory {
    return (shareName: string, notifyDeleted: () => void) => {
        const directoryClientFactory = (directory: string) => shareClientFactory(shareName).getDirectoryClient(directory ?? '');

        return new FileShareItem(directoryClientFactory, shareName, storageAccount, storageRoot, notifyDeleted);
    }
}
