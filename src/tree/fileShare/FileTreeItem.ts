/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccountSASSignatureValues, ShareFileClient } from '@azure/storage-file-share';

import { polyfill } from '../../polyfill.worker';
polyfill();

import { AccountSASPermissions } from '@azure/storage-file-share';

import { AzExtTreeItem, DialogResponses, IActionContext, TreeItemIconPath, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { posix } from 'path';
import * as vscode from 'vscode';
import { MessageItem, window } from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { threeDaysInMS } from '../../constants';
import { copyAndShowToast } from '../../utils/copyAndShowToast';
import { createFileClient, deleteFile } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from '../IStorageRoot';
import { ITransferSrcOrDstTreeItem } from '../ITransferSrcOrDstTreeItem';
import { DirectoryTreeItem, IDirectoryDeleteContext } from "./DirectoryTreeItem";
import { FileShareTreeItem } from './FileShareTreeItem';

export class FileTreeItem extends AzExtTreeItem implements ICopyUrl, ITransferSrcOrDstTreeItem {
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

    public get resourceUri(): string {
        const shareClient = this.root.createShareServiceClient().getShareClient(this.shareName);
        return shareClient.url;
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

    public async copyUrl(): Promise<void> {
        const fileClient: ShareFileClient = createFileClient(this.root, this.shareName, this.directoryPath, this.fileName);
        const url = fileClient.url;
        await copyAndShowToast(url, 'File URL');
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
