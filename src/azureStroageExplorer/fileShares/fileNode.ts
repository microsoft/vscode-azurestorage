/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class FileNode implements IAzureTreeItem {
    constructor(
        public readonly file: azureStorage.FileService.FileResult,
        public readonly directory: string,
		public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {		
    }

    public id: string = this.file.name;
    public label: string = this.file.name;
    public contextValue: string = 'azureFile';
    public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
    };

   public commandId: string = 'azureStorage.editFile';
}