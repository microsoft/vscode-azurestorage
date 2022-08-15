import * as azureStorageShare from '@azure/storage-file-share';
import * as vscode from 'vscode';
import { PageSettings } from '@azure/core-paging';
import { maxPageSize } from '../../constants';
import { StorageAccountModel } from '../StorageAccountModel';
import { FileItem } from './FileItem';

export abstract class FileParentItem implements StorageAccountModel {
    constructor(
        private readonly directory: string | undefined,
        private readonly parentItemFactory: (directory: string) => FileParentItem,
        private readonly shareClientFactory: (directory: string | undefined) => azureStorageShare.ShareDirectoryClient) {
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

        children.push(...responseValue.segment.fileItems.map(fileItem => new FileItem(fileItem.name)));

        children.push(...responseValue.segment.directoryItems.map(directoryItem => this.parentItemFactory(directoryItem.name)));

        return children;
    }

    abstract getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}
