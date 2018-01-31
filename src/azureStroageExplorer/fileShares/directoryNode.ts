/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, window, ProgressLocation } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { FileNode } from './fileNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureParentTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { askAndCreateChildDirectory } from './createDirectories';
import { DialogBoxResponses } from '../../constants';
import { ChildKind } from './childKind';
import { validateFileName } from './validateNames';

export class DirectoryNode implements IAzureParentTreeItem {
    constructor(
        public readonly relativeDirectory: string, // full path of the parent
        public readonly directory: azureStorage.FileService.DirectoryResult, // directory.name should not include parent path
        public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {

    }

    private _continuationToken: azureStorage.common.ContinuationToken;
    public id: string = undefined;
    public label: string = this.directory.name;
    public contextValue: string = 'azureFileShareDirectory';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'folder.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'folder.svg')
    };

    private get fullPath(): string {
        return path.posix.join(this.relativeDirectory, this.directory.name);
    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        var fileResults = await this.listFiles(this._continuationToken);
        var { entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;

        return []
            .concat(entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
                return new DirectoryNode(this.fullPath, directory, this.share, this.storageAccount, this.key);
            }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileNode(file, this.fullPath, this.share, this.storageAccount, this.key);
            }));
    }

    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise((resolve, reject) => {
            var fileService = this.createFileService();
            fileService.listFilesAndDirectoriesSegmented(this.share.name, this.fullPath, currentToken, { maxResults: 50 }, (err: Error, result: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        });
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void, userOptions?: any): Promise<IAzureTreeItem> {
        if (<ChildKind>userOptions === ChildKind.File) {
            return this.askAndCreateEmptyTextFile(showCreatingNode);
        } else {
            return askAndCreateChildDirectory(this.share, this.fullPath, this.storageAccount, this.key, showCreatingNode);
        }
    }

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        // Note: Azure will fail the directory delete if it's not empty, so no need to ask about deleting contents
        const message: string = `Are you sure you want to delete the directory '${this.label} (it must be empty)'?`;
        const result = await window.showWarningMessage(message, DialogBoxResponses.Yes, DialogBoxResponses.Cancel);
        if (result === DialogBoxResponses.Yes) {
            const fileService = this.createFileService();
            await new Promise((resolve, reject) => {
                fileService.deleteDirectory(this.share.name, this.fullPath, function (err) {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }

    private createFileService() {
        return azureStorage.createFileService(this.storageAccount.name, this.key.value);
    }

    // Currently only supports creating block blobs
    private async askAndCreateEmptyTextFile(showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const fileName = await window.showInputBox({
            placeHolder: `Enter a name for the new file`,
            validateInput: validateFileName
        });

        if (fileName) {
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                showCreatingNode(fileName);
                progress.report({ message: `Azure Storage: Creating file '${fileName}'` });
                const file = await this.createFile(fileName);
                const actualFile = await this.getFile(file.name);
                return new FileNode(actualFile, this.fullPath, this.share, this.storageAccount, this.key);
            });
        }

        throw new UserCancelledError();
    }

    private getFile(name: string): Promise<azureStorage.FileService.FileResult> {
        var fileService = this.createFileService();
        return new Promise((resolve, reject) => {
            fileService.getFileProperties(this.share.name, this.fullPath, name, (err: Error, result: azureStorage.FileService.FileResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        });
    }

    private createFile(name: string): Promise<azureStorage.FileService.FileResult> {
        return new Promise((resolve, reject) => {
            var fileService = this.createFileService();
            fileService.createFile(this.share.name, this.fullPath, name, 0, (err: Error, result: azureStorage.FileService.FileResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
}
