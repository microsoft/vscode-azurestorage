/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { DialogOptions } from '../../azureServiceExplorer/messageItems/dialogOptions';
import { deleteFile } from './fileUtils';

export class FileNode implements IAzureTreeItem {
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

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete the file '${this.label}'?`;
        const result = await window.showWarningMessage(message, DialogOptions.yes, DialogOptions.cancel);
        if (result === DialogOptions.yes) {
            await deleteFile(this.directoryPath, this.file.name, this.share.name, this.storageAccount.name, this.key.value);
        } else {
            throw new UserCancelledError();
        }
    }
}
