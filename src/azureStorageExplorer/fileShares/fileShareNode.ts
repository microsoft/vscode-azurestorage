/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as clipboardy from 'clipboardy';
import * as path from 'path';
import { Uri, window } from 'vscode';
import { AzureParentTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { DirectoryTreeItem } from './directoryNode';
import { askAndCreateChildDirectory } from './directoryUtils';
import { FileTreeItem } from './fileNode';
import { askAndCreateEmptyTextFile } from './fileUtils';

export class FileShareTreeItem extends AzureParentTreeItem<IStorageRoot> implements ICopyUrl {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    constructor(
        parent: AzureParentTreeItem,
        public readonly share: azureStorage.FileService.ShareResult) {
        super(parent);
    }

    public label: string = this.share.name;
    public contextValue: string = 'azureFileShare';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureFileShare.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureFileShare.svg')
    };

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<(DirectoryTreeItem | FileTreeItem)[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // currentToken argument typed incorrectly in SDK
        let fileResults = await this.listFiles(<azureStorage.common.ContinuationToken>this._continuationToken);
        let { entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;
        return (<(DirectoryTreeItem | FileTreeItem)[]>[])
            .concat(entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
                return new DirectoryTreeItem(this, '', directory, this.share);
            }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileTreeItem(this, file, '', this.share);
            }));
    }

    public async copyUrl(): Promise<void> {
        let fileService = this.root.createFileService();
        let url = fileService.getUrl(this.share.name, "");
        clipboardy.write(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Share URL copied to clipboard: ${url}`);
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise((resolve, reject) => {
            let fileService = this.root.createFileService();
            fileService.listFilesAndDirectoriesSegmented(this.share.name, '', currentToken, { maxResults: 50 }, (err?: Error, result?: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete file share '${this.label}' and all its contents?`;
        const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const fileService = this.root.createFileService();
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

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, userOptions?: {}): Promise<DirectoryTreeItem | FileTreeItem> {
        if (userOptions === FileTreeItem.contextValue) {
            return askAndCreateEmptyTextFile(this, '', this.share, showCreatingTreeItem);
        } else {
            return askAndCreateChildDirectory(this, '', this.share, showCreatingTreeItem);
        }
    }
}
