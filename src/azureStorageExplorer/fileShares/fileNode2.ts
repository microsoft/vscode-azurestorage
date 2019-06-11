/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as clipboardy from 'clipboardy';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { deleteFile } from './fileUtils';

export class FileTreeItem2 extends AzureTreeItem<IStorageRoot> implements ICopyUrl {
    constructor(
        parent: AzureParentTreeItem,
        public readonly file: azureStorage.FileService.FileResult,
        public readonly directoryPath: string,
        public readonly share: azureStorage.FileService.ShareResult) {
        super(parent);
    }

    public label: string = this.file.name;
    public static contextValue: string = 'azureFile';
    public contextValue: string = FileTreeItem2.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'document.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'document.svg')
    };

    public commandId: string = 'azureStorage.editFile';

    public async copyUrl(): Promise<void> {
        let fileService = this.root.createFileService();
        let url = fileService.getUrl(this.share.name, this.directoryPath, this.file.name);
        await clipboardy.write(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`File URL copied to clipboard: ${url}`);
    }

    public async rename(newParent: AzureParentTreeItem, newFileName: string): Promise<void> {
        // this.parent = newParent;
        // this.label = newFileName;
        // this.directoryPath = newFileName;


        // need to update parent, file
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete the file '${this.label}'?`;
        const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            await deleteFile(this.directoryPath, this.file.name, this.share.name, this.root);
        } else {
            throw new UserCancelledError();
        }
    }
}
