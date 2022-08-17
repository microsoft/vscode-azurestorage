/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import { AzExtTreeItem, DialogResponses, IActionContext, TreeItemIconPath, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { posix } from 'path';
import * as vscode from 'vscode';
import { MessageItem, window } from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { ext } from "../../extensionVariables";
import { createFileClient, deleteFile } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IDownloadableTreeItem } from '../IDownloadableTreeItem';
import { IStorageRoot } from '../IStorageRoot';
import { DirectoryTreeItem, IDirectoryDeleteContext } from "./DirectoryTreeItem";
import { FileShareTreeItem } from './FileShareTreeItem';

export class FileTreeItem extends AzExtTreeItem implements ICopyUrl, IDownloadableTreeItem {
    public parent: FileShareTreeItem | DirectoryTreeItem;
    constructor(
        parent: FileShareTreeItem | DirectoryTreeItem,
        public readonly fileName: string,
        public readonly directoryPath: string,
        public readonly shareName: string) {
        super(parent);
        this.commandId = 'azureStorage.editFile';
    }

    public label: string = this.fileName;
    public static contextValue: string = 'azureFile';
    public contextValue: string = FileTreeItem.contextValue;

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public get remoteFilePath(): string {
        return posix.join(this.directoryPath, this.fileName);
    }

    public get iconPath(): TreeItemIconPath {
        return new vscode.ThemeIcon('file');
    }

    public async copyUrl(): Promise<void> {
        const fileClient: azureStorageShare.ShareFileClient = createFileClient(this.root, this.shareName, this.directoryPath, this.fileName);
        const url = fileClient.url;
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLog(`File URL copied to clipboard: ${url}`);
    }

    public async deleteTreeItemImpl(context: IActionContext & IDirectoryDeleteContext): Promise<void> {
        let result: MessageItem | undefined;
        if (!context.suppressMessage) {
            const message: string = `Are you sure you want to delete the file '${this.label}'?`;
            result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        } else {
            result = DialogResponses.deleteResponse;
        }

        if (result === DialogResponses.deleteResponse) {
            await deleteFile(this.directoryPath, this.fileName, this.shareName, this.root);
        } else {
            throw new UserCancelledError();
        }

        AzureStorageFS.fireDeleteEvent(this);
    }
}
