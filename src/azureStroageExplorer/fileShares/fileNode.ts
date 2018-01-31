/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { DialogBoxResponses } from '../../constants';

export class FileNode implements IAzureTreeItem {
    constructor(
        public readonly file: azureStorage.FileService.FileResult,
        public readonly directory: string,
        public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public id: string = undefined;
    public label: string = this.file.name;
    public contextValue: string = 'azureFile';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
    };

    public commandId: string = 'azureStorage.editFile';

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete the file '${this.label}'?`;
        const result = await window.showWarningMessage(message, DialogBoxResponses.Yes, DialogBoxResponses.Cancel);
        if (result === DialogBoxResponses.Yes) {
            const fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            await new Promise((resolve, reject) => {
                fileService.deleteFile(this.share.name, this.directory, this.file.name, function (err) {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }
}
