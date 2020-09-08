/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import * as azureStorageShare from '@azure/storage-file-share';
import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from "../../AzureStorageFS";
import { createAzCopyDestination, createAzCopyLocalSource } from '../../commands/azCopy/azCopyLocations';
import { azCopyTransfer } from '../../commands/azCopy/azCopyTransfer';
import { IExistingFileContext } from '../../commands/uploadFile';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { TransferProgress } from '../../TransferProgress';
import { askAndCreateChildDirectory, doesDirectoryExist, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile, createDirectoryClient, createShareClient } from '../../utils/fileUtils';
import { getUploadingMessageWithSource } from '../../utils/uploadUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { DirectoryTreeItem } from './DirectoryTreeItem';
import { FileTreeItem } from './FileTreeItem';

export class FileShareTreeItem extends AzureParentTreeItem<IStorageRoot> implements ICopyUrl {
    private _continuationToken: string | undefined;
    private _openInFileExplorerString: string = 'Open in File Explorer...';

    constructor(
        parent: AzureParentTreeItem,
        public readonly shareName: string) {
        super(parent);
    }

    public label: string = this.shareName;
    public static contextValue: string = 'azureFileShare';
    public contextValue: string = FileShareTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
    };

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

        let { files, directories, continuationToken }: { files: azureStorageShare.FileItem[]; directories: azureStorageShare.DirectoryItem[]; continuationToken: string; } = await listFilesInDirectory('', this.shareName, this.root, this._continuationToken);
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

    public async copyUrl(): Promise<void> {
        const shareClient: azureStorageShare.ShareClient = createShareClient(this.root, this.shareName);
        await vscode.env.clipboard.writeText(shareClient.url);
        ext.outputChannel.show();
        ext.outputChannel.appendLog(`Share URL copied to clipboard: ${shareClient.url}`);
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete file share '${this.label}' and all its contents?`;
        const result = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
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
        notificationProgress?: vscode.Progress<{
            message?: string | undefined;
            increment?: number | undefined;
        }>,
        cancellationToken?: vscode.CancellationToken
    ): Promise<void> {
        const parentDirectoryPath: string = path.dirname(destFilePath);
        const parentDirectories: string[] = parentDirectoryPath.split('/');

        ext.outputChannel.appendLog(getUploadingMessageWithSource(sourceFilePath, this.label));

        // Ensure parent directories exist before creating child files
        let partialParentDirectoryPath: string = '';
        for (let dir of parentDirectories) {
            partialParentDirectoryPath += `${dir}/`;
            if (!(await doesDirectoryExist(this, partialParentDirectoryPath, this.shareName))) {
                const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(this.root, this.shareName, partialParentDirectoryPath);
                await directoryClient.create();
            }
        }

        const fileSize: number = (await fse.stat(sourceFilePath)).size;
        // tslint:disable-next-line: strict-boolean-expressions
        const transferProgress: TransferProgress = new TransferProgress(fileSize || 1, destFilePath);
        const src: ILocalLocation = createAzCopyLocalSource(sourceFilePath);
        const dst: IRemoteSasLocation = createAzCopyDestination(this, destFilePath);
        await azCopyTransfer(context, 'LocalFile', src, dst, transferProgress, notificationProgress, cancellationToken);
    }
}

export interface IFileShareCreateChildContext extends IActionContext {
    childType: string;
    childName?: string;
}
