import { PageSettings } from '@azure/core-paging';
import * as azureStorageShare from '@azure/storage-file-share';
import * as vscode from 'vscode';
import { maxPageSize } from '../../constants';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from '../StorageAccountModel';
import { FileItem } from './FileItem';

export type ShareDirectoryClientFactory = (directory: string | undefined) => azureStorageShare.ShareDirectoryClient;

export abstract class FileParentItem implements StorageAccountModel {
    constructor(
        private readonly directory: string | undefined,
        public readonly shareName: string,
        private readonly parentItemFactory: (directory: string) => FileParentItem,
        private readonly shareClientFactory: ShareDirectoryClientFactory,
        public readonly storageRoot: IStorageRoot) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const directoryClient: azureStorageShare.ShareDirectoryClient = this.shareClientFactory(this.directory);

        // TODO: Manage paging.
        let continuationToken: string | undefined = undefined;
        const settings: PageSettings = {
            continuationToken,
            maxPageSize
        };
        const response: AsyncIterableIterator<azureStorageShare.DirectoryListFilesAndDirectoriesSegmentResponse> = directoryClient.listFilesAndDirectories().byPage(settings);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const responseValue: azureStorageShare.DirectoryListFilesAndDirectoriesSegmentResponse = (await response.next()).value;
        continuationToken = responseValue.continuationToken;

        const children: StorageAccountModel[] = [];

        children.push(...responseValue.segment.fileItems.map(fileItem => new FileItem(fileItem.name, this.shareName, this.storageRoot)));

        children.push(...responseValue.segment.directoryItems.map(directoryItem => this.parentItemFactory(directoryItem.name)));

        return children;
    }

    abstract getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}
