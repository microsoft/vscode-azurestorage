/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { FileNode } from './fileNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureParentTreeItem } from 'vscode-azureextensionui';

export class DirectoryNode implements IAzureParentTreeItem {
    constructor(
        public readonly relativeDirectory: string,
		public readonly directory: azureStorage.FileService.DirectoryResult,
		public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
		
    }

    private _continuationToken: azureStorage.common.ContinuationToken;
    public id: string = undefined;
    public label: string = this.directory.name;
    public contextValue: string = 'azureFileshareDirectory';
    public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'folder.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'folder.svg')
    };

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }
    
    async loadMoreChildren(): Promise<IAzureTreeItem[]> {
        var fileResults = await this.listFiles(this._continuationToken);
        var {entries, continuationToken} = fileResults;
        this._continuationToken = continuationToken;

        return []
        .concat( entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
            return new DirectoryNode(path.posix.join(this.relativeDirectory, this.directory.name), directory, this.share, this.storageAccount, this.key);
        }))
        .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
            return new FileNode(file, path.posix.join(this.relativeDirectory, this.directory.name), this.share, this.storageAccount, this.key);
        }));
    }

    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise(resolve => {
            var fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            fileService.listFilesAndDirectoriesSegmented(this.share.name, path.posix.join(this.relativeDirectory, this.directory.name), currentToken, {maxResults: 50}, (_err, result: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
				resolve(result);
			})
		});
    }
}