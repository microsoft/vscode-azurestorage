/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri, window } from 'vscode';
import { DialogResponses, IAzureNode, IAzureParentNode, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { deleteFile } from './fileUtils';

import * as copypaste from 'copy-paste';
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';

export class FileNode implements IAzureTreeItem, ICopyUrl {
    constructor(
        public readonly file: azureStorage.FileService.FileResult,
        public readonly directoryPath: string,
        public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public label: string = this.file.name;
    public static contextValue: string = 'azureFile';
    public contextValue: string = FileNode.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
    };

    public commandId: string = 'azureStorage.editFile';

    public async copyUrl(_node: IAzureParentNode): Promise<void> {
        let fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
        let url = fileService.getUrl(this.share.name, this.directoryPath, this.file.name);
        copypaste.copy(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`File URL copied to clipboard: ${url}`);
    }

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete the file '${this.label}'?`;
        const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            await deleteFile(this.directoryPath, this.file.name, this.share.name, this.storageAccount.name, this.key.value);
        } else {
            throw new UserCancelledError();
        }
    }
}
