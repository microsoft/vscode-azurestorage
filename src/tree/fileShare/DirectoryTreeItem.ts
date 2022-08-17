/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import { AzExtParentTreeItem, AzExtTreeItem, DialogResponses, IActionContext, ICreateChildImplContext, TreeItemIconPath, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { posix } from 'path';
import * as vscode from 'vscode';
import { MessageItem, window } from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { ext } from "../../extensionVariables";
import { askAndCreateChildDirectory, deleteDirectoryAndContents, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile, createDirectoryClient } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IDownloadableTreeItem } from '../IDownloadableTreeItem';
import { IStorageRoot } from '../IStorageRoot';
import { FileShareTreeItem, IFileShareCreateChildContext } from "./FileShareTreeItem";
import { FileTreeItem } from './FileTreeItem';

export class DirectoryTreeItem extends AzExtParentTreeItem implements ICopyUrl, IDownloadableTreeItem {
    public parent: FileShareTreeItem | DirectoryTreeItem;
    constructor(
        parent: FileShareTreeItem | DirectoryTreeItem,
        public readonly parentPath: string,
        public readonly directoryName: string, // directoryName should not include parent path
        public readonly shareName: string) {
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
        return posix.join(this.parentPath, this.directoryName);
    }

    public get iconPath(): TreeItemIconPath {
        return new vscode.ThemeIcon('folder');
    }

    private get fullPath(): string {
        return path.posix.join(this.parentPath, this.directoryName);
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<(DirectoryTreeItem | FileTreeItem)[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        const { files, directories, continuationToken }: { files: azureStorageShare.FileItem[]; directories: azureStorageShare.DirectoryItem[]; continuationToken: string; } = await listFilesInDirectory(this.fullPath, this.shareName, this.root, this._continuationToken);
        this._continuationToken = continuationToken;

        return (<(DirectoryTreeItem | FileTreeItem)[]>[])
            .concat(files.map((file: azureStorageShare.FileItem) => {
                return new FileTreeItem(this, file.name, this.fullPath, this.shareName);
            }))
            .concat(directories.map((directory: azureStorageShare.DirectoryItem) => {
                return new DirectoryTreeItem(this, this.fullPath, directory.name, this.shareName);
            }));
    }

    public async copyUrl(): Promise<void> {
        // Use this.fullPath here instead of this.directoryName. Otherwise only the leaf directory is displayed in the URL
        const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(this.root, this.shareName, this.fullPath);
        const url = directoryClient.url;
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLog(`Directory URL copied to clipboard: ${url}`);
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
