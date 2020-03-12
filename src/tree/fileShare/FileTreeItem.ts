/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from "../../AzureStorageFS";
import { attachedSuffix, getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { createFileClient, deleteFile } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { IDirectoryDeleteContext } from "./DirectoryTreeItem";

export class FileTreeItem extends AzureTreeItem<IStorageRoot> implements ICopyUrl {
    constructor(
        parent: AzureParentTreeItem,
        public readonly fileName: string,
        public readonly directoryPath: string,
        public readonly shareName: string) {
        super(parent);
    }

    public label: string = this.fileName;
    public static baseContextValue: string = 'azureFile';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'document.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'document.svg')
    };

    public commandId: string = 'azureStorage.editFile';

    public get contextValue(): string {
        return `${FileTreeItem.baseContextValue}${this.root.isAttached ? attachedSuffix : ''}`;
    }

    public async copyUrl(): Promise<void> {
        const fileClient: azureStorageShare.ShareFileClient = createFileClient(this.root, this.shareName, this.directoryPath, this.fileName);
        const url = fileClient.url;
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`File URL copied to clipboard: ${url}`);
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
