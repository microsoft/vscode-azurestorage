/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as copypaste from 'copy-paste';
import * as path from 'path';
import { Uri, window } from 'vscode';
import { DialogResponses, IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from "../../components/storageWrappers";
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { DirectoryNode } from './directoryNode';
import { askAndCreateChildDirectory } from './directoryUtils';
import { FileNode } from './fileNode';
import { askAndCreateEmptyTextFile } from './fileUtils';

export class FileShareNode implements IAzureParentTreeItem, ICopyUrl {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    constructor(
        public readonly share: azureStorage.FileService.ShareResult,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly key: StorageAccountKeyWrapper) {
    }

    public label: string = this.share.name;
    public contextValue: string = 'azureFileShare';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureFileShare_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureFileShare_16x.png')
    };

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // tslint:disable-next-line:no-non-null-assertion // currentToken argument typed incorrectly in SDK
        let fileResults = await this.listFiles(this._continuationToken!);
        let { entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;
        return (<IAzureTreeItem[]>[])
            .concat(entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
                return new DirectoryNode('', directory, this.share, this.storageAccount, this.key);
            }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileNode(file, '', this.share, this.storageAccount, this.key);
            }));
    }

    public async copyUrl(_node: IAzureParentNode): Promise<void> {
        let fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
        let url = fileService.getUrl(this.share.name, "");
        copypaste.copy(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Share URL copied to clipboard: ${url}`);
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise((resolve, reject) => {
            let fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            fileService.listFilesAndDirectoriesSegmented(this.share.name, '', currentToken, { maxResults: 50 }, (err?: Error, result?: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete file share '${this.label}' and all its contents?`;
        const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const fileService = azureStorage.createFileService(this.storageAccount.name, this.key.value);
            await new Promise((resolve, reject) => {
                // tslint:disable-next-line:no-any
                fileService.deleteShare(this.share.name, (err?: any) => {
                    // tslint:disable-next-line:no-void-expression // Grandfathered in
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void, userOptions?: {}): Promise<IAzureTreeItem> {
        if (userOptions === FileNode.contextValue) {
            return askAndCreateEmptyTextFile('', this.share, this.storageAccount, this.key, showCreatingNode);
        } else {
            return askAndCreateChildDirectory('', this.share, this.storageAccount, this.key, showCreatingNode);
        }
    }
}
