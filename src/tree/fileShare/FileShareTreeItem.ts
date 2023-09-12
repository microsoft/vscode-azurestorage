/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import * as azureStorageShare from '@azure/storage-file-share';
import { AzExtParentTreeItem, AzExtTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { TransferProgress } from '../../TransferProgress';
import { getResourceUri } from '../../commands/downloadFiles/getResourceUri';
import { getSasToken } from '../../commands/downloadFiles/getSasToken';
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from '../../commands/transfers/azCopy/azCopyLocations';
import { azCopyTransfer } from '../../commands/transfers/azCopy/azCopyTransfer';
import { IExistingFileContext } from '../../commands/uploadFiles/IExistingFileContext';
import { NotificationProgress, getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { copyAndShowToast } from '../../utils/copyAndShowToast';
import { askAndCreateChildDirectory, doesDirectoryExist, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile, createDirectoryClient, createShareClient } from '../../utils/fileUtils';
import { getUploadingMessageWithSource } from '../../utils/uploadUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IDownloadableTreeItem } from '../IDownloadableTreeItem';
import { IStorageRoot } from '../IStorageRoot';
import { DirectoryTreeItem } from './DirectoryTreeItem';
import { FileShareGroupTreeItem } from './FileShareGroupTreeItem';
import { FileTreeItem } from './FileTreeItem';

export class FileShareTreeItem extends AzExtParentTreeItem implements ICopyUrl, IDownloadableTreeItem {
    public parent: FileShareGroupTreeItem;
    private _continuationToken: string | undefined;
    private _openInFileExplorerString: string = 'Open in Explorer...';

    constructor(
        parent: FileShareGroupTreeItem,
        public readonly shareName: string) {
        super(parent);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
        };
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public get remoteFilePath(): string {
        return '';
    }

    public label: string = this.shareName;
    public static contextValue: string = 'azureFileShare';
    public contextValue: string = FileShareTreeItem.contextValue;

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<(AzExtTreeItem)[]> {
        const result: AzExtTreeItem[] = [];

        if (clearCache) {
            this._continuationToken = undefined;
            const ti = new GenericTreeItem(this, {
                label: this._openInFileExplorerString,
                commandId: 'azureStorage.openInFileExplorer',
                contextValue: 'openInFileExplorer'
            });

            ti.commandArgs = [this];
            result.push(ti);
        }

        const { files, directories, continuationToken }: { files: azureStorageShare.FileItem[]; directories: azureStorageShare.DirectoryItem[]; continuationToken: string; } = await listFilesInDirectory('', this.shareName, this.root, this._continuationToken);
        this._continuationToken = continuationToken;
        return result.concat(directories.map((directory: azureStorageShare.DirectoryItem) => {
            return new DirectoryTreeItem(this, '', directory.name, this.shareName);
        }))
            .concat(files.map((file: azureStorageShare.FileItem) => {
                return new FileTreeItem(this, file.name, '', this.shareName);
            }));
    }

    public compareChildrenImpl(ti1: FileShareTreeItem, ti2: FileShareTreeItem): number {
        if (ti1.label === this._openInFileExplorerString) {
            return -1;
        } else if (ti2.label === this._openInFileExplorerString) {
            return 1;
        }

        return ti1.label.localeCompare(ti2.label);
    }

    public getUrl(): string {
        const shareClient: azureStorageShare.ShareClient = createShareClient(this.root, this.shareName);
        return shareClient.url;
    }

    public async copyUrl(): Promise<void> {
        const url: string = this.getUrl();
        await copyAndShowToast(url, 'Share URL');
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const message: string = `Are you sure you want to delete file share '${this.label}' and all its contents?`;
        const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const shareClient: azureStorageShare.ShareClient = createShareClient(this.root, this.shareName);
            await shareClient.delete();
        } else {
            throw new UserCancelledError();
        }

        AzureStorageFS.fireDeleteEvent(this);
    }

    public async createChildImpl(context: ICreateChildImplContext & Partial<IExistingFileContext> & IFileShareCreateChildContext): Promise<AzExtTreeItem> {
        let child: AzExtTreeItem;
        if (context.remoteFilePath && context.localFilePath) {
            context.showCreatingTreeItem(context.remoteFilePath);
            await this.uploadLocalFile(context, context.localFilePath, context.remoteFilePath);
            child = new FileTreeItem(this, context.remoteFilePath, '', this.shareName);
        } else if (context.childType === FileTreeItem.contextValue) {
            child = await askAndCreateEmptyTextFile(this, '', this.shareName, context);
        } else {
            child = await askAndCreateChildDirectory(this, '', this.shareName, context);
        }
        AzureStorageFS.fireCreateEvent(child);
        return child;
    }

    public async uploadLocalFile(
        context: IActionContext,
        sourceFilePath: string,
        destFilePath: string,
        notificationProgress?: NotificationProgress,
        cancellationToken?: vscode.CancellationToken
    ): Promise<void> {
        const parentDirectoryPath: string = path.dirname(destFilePath);
        const parentDirectories: string[] = parentDirectoryPath.split('/');

        ext.outputChannel.appendLog(getUploadingMessageWithSource(sourceFilePath, this.label));

        // Ensure parent directories exist before creating child files
        let partialParentDirectoryPath: string = '';
        for (const dir of parentDirectories) {
            partialParentDirectoryPath += `${dir}/`;
            if (!(await doesDirectoryExist(this, partialParentDirectoryPath, this.shareName))) {
                const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(this.root, this.shareName, partialParentDirectoryPath);
                await directoryClient.create();
            }
        }

        const transferProgress: TransferProgress = new TransferProgress('bytes', destFilePath);
        const src: ILocalLocation = createAzCopyLocalLocation(sourceFilePath);
        const resourceUri = getResourceUri(this);
        const sasToken = getSasToken(this.root);
        const dst: IRemoteSasLocation = createAzCopyRemoteLocation(resourceUri, sasToken, destFilePath);
        await azCopyTransfer(context, 'LocalFile', src, dst, transferProgress, notificationProgress, cancellationToken);
    }
}

export interface IFileShareCreateChildContext extends IActionContext {
    childType: string;
    childName?: string;
}
