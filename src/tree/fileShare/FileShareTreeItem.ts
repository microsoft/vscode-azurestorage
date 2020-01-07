/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri, workspace } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from "../../AzureStorageFS";
import { configurationSettingsKeys, extensionPrefix, getResourcesPath, maxPageSize } from "../../constants";
import { ext } from "../../extensionVariables";
import { askAndCreateChildDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { DirectoryTreeItem } from './DirectoryTreeItem';
import { FileTreeItem } from './FileTreeItem';

export class FileShareTreeItem extends AzureParentTreeItem<IStorageRoot> implements ICopyUrl {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;
    private _openInFileExplorerString: string = 'Open in File Explorer...';

    constructor(
        parent: AzureParentTreeItem,
        public readonly share: azureStorage.FileService.ShareResult) {
        super(parent);
    }

    public label: string = this.share.name;
    public static contextValue: string = 'azureFileShare';
    public contextValue: string = FileShareTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
    };

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<(AzExtTreeItem)[]> {
        const result: AzExtTreeItem[] = [];

        if (clearCache) {
            this._continuationToken = undefined;
            // tslint:disable-next-line: strict-boolean-expressions
            if (workspace.getConfiguration(extensionPrefix).get(configurationSettingsKeys.enableViewInFileExplorer)) {
                const ti = new GenericTreeItem(this, {
                    label: this._openInFileExplorerString,
                    commandId: 'azureStorage.openInFileExplorer',
                    contextValue: 'openInFileExplorer'
                });

                ti.commandArgs = [this];
                result.push(ti);
            }
        }

        // currentToken argument typed incorrectly in SDK
        let fileResults = await this.listFiles(<azureStorage.common.ContinuationToken>this._continuationToken);
        let { entries, continuationToken } = fileResults;
        this._continuationToken = continuationToken;
        return result.concat(entries.directories.map((directory: azureStorage.FileService.DirectoryResult) => {
            return new DirectoryTreeItem(this, '', directory, this.share);
        }))
            .concat(entries.files.map((file: azureStorage.FileService.FileResult) => {
                return new FileTreeItem(this, file, '', this.share);
            }));
    }

    public compareChildrenImpl(ti1: FileShareTreeItem, ti2: FileShareTreeItem): number {
        if (ti1.label === this._openInFileExplorerString) {
            return -1;
        } else if (ti2.label === this._openInFileExplorerString) {
            return 1;
        }

        return ti1.label.localeCompare(ti2.label);
    }

    public async copyUrl(): Promise<void> {
        let fileService = this.root.createFileService();
        let url = fileService.getUrl(this.share.name, "");
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Share URL copied to clipboard: ${url}`);
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listFiles(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
        return new Promise((resolve, reject) => {
            let fileService = this.root.createFileService();
            fileService.listFilesAndDirectoriesSegmented(this.share.name, '', currentToken, { maxResults: maxPageSize }, (err?: Error, result?: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
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
        const result = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
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

        AzureStorageFS.fireDeleteEvent(this);
    }

    public async createChildImpl(context: ICreateChildImplContext & IFileShareCreateChildContext): Promise<AzExtTreeItem> {
        let child: AzExtTreeItem;
        if (context.childType === FileTreeItem.contextValue) {
            child = await askAndCreateEmptyTextFile(this, '', this.share, context);
        } else {
            child = await askAndCreateChildDirectory(this, '', this.share, context);
        }
        AzureStorageFS.fireCreateEvent(child);
        return child;
    }
}

export interface IFileShareCreateChildContext extends IActionContext {
    childType: string;
    childName?: string;
}
