/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccountSASSignatureValues, DirectoryItem, FileItem, ShareDirectoryClient } from '@azure/storage-file-share';

import { polyfill } from '../../polyfill.worker';
polyfill();

import { AccountSASPermissions } from '@azure/storage-file-share';

import { AzExtParentTreeItem, AzExtTreeItem, DialogResponses, IActionContext, ICreateChildImplContext, TreeItemIconPath, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { posix } from 'path';
import * as vscode from 'vscode';
import { MessageItem, window } from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { threeDaysInMS } from '../../constants';
import { ext } from "../../extensionVariables";
import { copyAndShowToast } from '../../utils/copyAndShowToast';
import { askAndCreateChildDirectory, deleteDirectoryAndContents, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile, createDirectoryClient, createFileClient } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from '../IStorageRoot';
import { ITransferSrcOrDstTreeItem } from '../ITransferSrcOrDstTreeItem';
import { FileShareTreeItem, IFileShareCreateChildContext } from "./FileShareTreeItem";
import { FileTreeItem } from './FileTreeItem';

export class DirectoryTreeItem extends AzExtParentTreeItem implements ICopyUrl, ITransferSrcOrDstTreeItem {
    public parent: FileShareTreeItem | DirectoryTreeItem;
    constructor(
        parent: FileShareTreeItem | DirectoryTreeItem,
        public readonly parentPath: string,
        public readonly directoryName: string, // directoryName should not include parent path
        public readonly shareName: string,
        public readonly resourceUri: string) {
        super(parent);
    }

    private _continuationToken: string | undefined;
    public label: string = this.directoryName;
    public static contextValue: string = 'azureFileShareDirectory';
    public contextValue: string = DirectoryTreeItem.contextValue;

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public get remoteFilePath(): string {
        return posix.join(this.parentPath, this.directoryName, '/');
    }

    public get iconPath(): TreeItemIconPath {
        return new vscode.ThemeIcon('folder');
    }

    private get fullPath(): string {
        return path.posix.join(this.parentPath, this.directoryName);
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

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<(DirectoryTreeItem | FileTreeItem)[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        const { files, directories, continuationToken }: { files: FileItem[]; directories: DirectoryItem[]; continuationToken: string; } = await listFilesInDirectory(this.fullPath, this.shareName, this.root, this._continuationToken);
        this._continuationToken = continuationToken;

        const fileTreeItems: FileTreeItem[] = await Promise.all(files.map(async (file: FileItem) => {
            const shareClient = await createFileClient(this.root, this.shareName, this.directoryName, file.name);
            return new FileTreeItem(this, file.name, this.fullPath, this.shareName, shareClient.url);
        }));

        const directoryTreeItems: DirectoryTreeItem[] = await Promise.all(directories.map(async (directory: DirectoryItem) => {
            const directoryClient = await createDirectoryClient(this.root, this.shareName, directory.name);
            return new DirectoryTreeItem(this, this.fullPath, directory.name, this.shareName, directoryClient.url);
        }));

        return (<(DirectoryTreeItem | FileTreeItem)[]>[])
            .concat(fileTreeItems)
            .concat(directoryTreeItems);
    }

    public async copyUrl(): Promise<void> {
        // Use this.fullPath here instead of this.directoryName. Otherwise only the leaf directory is displayed in the URL
        const directoryClient: ShareDirectoryClient = await createDirectoryClient(this.root, this.shareName, this.fullPath);
        const url = directoryClient.url;
        await copyAndShowToast(url, 'Directory URL');
    }

    public async createChildImpl(context: ICreateChildImplContext & IFileShareCreateChildContext): Promise<AzExtTreeItem> {
        let child: AzExtTreeItem;
        if (context.childType === FileTreeItem.contextValue) {
            child = await askAndCreateEmptyTextFile(this, this.fullPath, this.shareName, context);
        } else {
            child = await askAndCreateChildDirectory(this, this.fullPath, this.shareName, context);
        }
        AzureStorageFS.fireCreateEvent(child);
        return child;
    }

    public async deleteTreeItemImpl(context: IActionContext & IDirectoryDeleteContext): Promise<void> {
        let result: MessageItem | undefined;
        if (!context.suppressMessage) {
            // Note: Azure will fail the directory delete if it's not empty, so no need to ask about deleting contents
            const message: string = `Are you sure you want to delete the directory '${this.label}' and all of its files and subdirectories?`;
            result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        } else {
            result = DialogResponses.deleteResponse;
        }

        if (result === DialogResponses.deleteResponse) {
            ext.outputChannel.show();
            await deleteDirectoryAndContents(this.fullPath, this.shareName, this.root);
        } else {
            throw new UserCancelledError();
        }

        AzureStorageFS.fireDeleteEvent(this);
    }
}

export interface IDirectoryDeleteContext extends IActionContext {
    suppressMessage?: boolean;
}
