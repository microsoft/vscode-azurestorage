/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, DialogResponses, IActionContext, TreeItemIconPath, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { MessageItem, window } from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { deleteFile } from '../../utils/fileUtils';
import { IStorageRoot } from '../IStorageRoot';
import { IStorageTreeItem } from '../IStorageTreeItem';
import { DirectoryTreeItem, IDirectoryDeleteContext } from "./DirectoryTreeItem";
import { FileShareTreeItem } from './FileShareTreeItem';

export class FileTreeItem extends AzExtTreeItem implements IStorageTreeItem {
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

    public get iconPath(): TreeItemIconPath {
        return new vscode.ThemeIcon('file');
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
