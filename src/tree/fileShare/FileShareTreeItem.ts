/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccountSASSignatureValues, DirectoryItem, FileItem, ShareClient, ShareDirectoryClient, ShareServiceClient } from '@azure/storage-file-share';

import { polyfill } from '../../polyfill.worker';
polyfill();

import { AccountSASPermissions } from '@azure/storage-file-share';

import { AzExtParentTreeItem, AzExtTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { UploadItem, uploadFile } from '../../commands/transfers/transfers';
import { IExistingFileContext } from '../../commands/uploadFiles/IExistingFileContext';
import { NotificationProgress, getResourcesPath, threeDaysInMS } from "../../constants";
import { copyAndShowToast } from '../../utils/copyAndShowToast';
import { askAndCreateChildDirectory, doesDirectoryExist, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile, createDirectoryClient, createShareClient } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from '../IStorageRoot';
import { ITransferSrcOrDstTreeItem } from '../ITransferSrcOrDstTreeItem';
import { DirectoryTreeItem } from './DirectoryTreeItem';
import { FileShareGroupTreeItem } from './FileShareGroupTreeItem';
import { FileTreeItem } from './FileTreeItem';

export class FileShareTreeItem extends AzExtParentTreeItem implements ICopyUrl, ITransferSrcOrDstTreeItem {
    public parent: FileShareGroupTreeItem;
    private _continuationToken: string | undefined;
    private _openInFileExplorerString: string = 'Open in Explorer...';

    constructor(
        parent: FileShareGroupTreeItem,
        public readonly shareName: string,
        public readonly resourceUri: string) {
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

    public get transferSasToken(): string {
        const accountSASSignatureValues: AccountSASSignatureValues = {
            expiresOn: new Date(Date.now() + threeDaysInMS),
            permissions: AccountSASPermissions.parse("rwl"), // read, write, list
            services: 'f', // file
            resourceTypes: 'co' // container, object
        };
        return this.root.generateSasToken(accountSASSignatureValues);
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

        const { files, directories, continuationToken }: { files: FileItem[]; directories: DirectoryItem[]; continuationToken: string; } = await listFilesInDirectory('', this.shareName, this.root, this._continuationToken);
        this._continuationToken = continuationToken;
        const shareServiceClient = await this.root.createShareServiceClient();
        return result.concat(directories.map((directory: DirectoryItem) => {
            return new DirectoryTreeItem(this, '', directory.name, this.shareName, shareServiceClient.getShareClient(this.shareName).url);
        }))
            .concat(files.map((file: FileItem) => {
                return new FileTreeItem(this, file.name, '', this.shareName, shareServiceClient.getShareClient(this.shareName).url);
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
        return this.resourceUri;
    }

    public async copyUrl(): Promise<void> {
        const url: string = this.getUrl();
        await copyAndShowToast(url, 'Share URL');
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const message: string = `Are you sure you want to delete file share '${this.label}' and all its contents?`;
        const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const shareClient: ShareClient = await createShareClient(this.root, this.shareName);
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
            const shareServiceClient: ShareServiceClient = await this.root.createShareServiceClient();
            child = new FileTreeItem(this, context.remoteFilePath, '', this.shareName, shareServiceClient.getShareClient(this.shareName).url);
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

        // Ensure parent directories exist before creating child files
        let partialParentDirectoryPath: string = '';
        for (const dir of parentDirectories) {
            partialParentDirectoryPath += `${dir}/`;
            if (!(await doesDirectoryExist(this, partialParentDirectoryPath, this.shareName))) {
                const directoryClient: ShareDirectoryClient = await createDirectoryClient(this.root, this.shareName, partialParentDirectoryPath);
                await directoryClient.create();
            }
        }

        const uploadItem: UploadItem = {
            type: "file",
            localFilePath: sourceFilePath,
            resourceName: this.shareName,
            resourceUri: this.resourceUri,
            remoteFilePath: destFilePath,
            transferSasToken: this.transferSasToken,
        };
        await uploadFile(context, uploadItem, notificationProgress, cancellationToken);
    }
}

export interface IFileShareCreateChildContext extends IActionContext {
    childType: string;
    childName?: string;
}
