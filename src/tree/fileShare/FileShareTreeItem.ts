/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri, workspace } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from "../../AzureStorageFS";
import { configurationSettingsKeys, extensionPrefix, getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { askAndCreateChildDirectory, listFilesInDirectory } from '../../utils/directoryUtils';
import { askAndCreateEmptyTextFile, createShareClient } from '../../utils/fileUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { DirectoryTreeItem } from './DirectoryTreeItem';
import { FileTreeItem } from './FileTreeItem';

export class FileShareTreeItem extends AzureParentTreeItem<IStorageRoot> implements ICopyUrl {
    private _continuationToken: string | undefined;
    private _openInFileExplorerString: string = 'Open in File Explorer...';

    constructor(
        parent: AzureParentTreeItem,
        public readonly shareName: string) {
        super(parent);
    }

    public label: string = this.shareName;
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

        let { files, directories, continuationToken }: { files: azureStorageShare.FileItem[]; directories: azureStorageShare.DirectoryItem[]; continuationToken: string; } = await listFilesInDirectory('', this.shareName, this.root, this._continuationToken);
        this._continuationToken = continuationToken;
        return result.concat(directories.map((directory: azureStorageShare.DirectoryItem) => {
            return new DirectoryTreeItem(this, '', directory.name, this.shareName);
        }))
            .concat(files.map((file: azureStorageShare.FileItem) => {
                return new FileTreeItem(this, file.name, '', this.shareName);
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
        const shareClient: azureStorageShare.ShareClient = createShareClient(this.root, this.shareName);
        await vscode.env.clipboard.writeText(shareClient.url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Share URL copied to clipboard: ${shareClient.url}`);
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete file share '${this.label}' and all its contents?`;
        const result = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const shareClient: azureStorageShare.ShareClient = createShareClient(this.root, this.shareName);
            await shareClient.delete();
        } else {
            throw new UserCancelledError();
        }

        AzureStorageFS.fireDeleteEvent(this);
    }

    public async createChildImpl(context: ICreateChildImplContext & IFileShareCreateChildContext): Promise<AzExtTreeItem> {
        let child: AzExtTreeItem;
        if (context.childType === FileTreeItem.contextValue) {
            child = await askAndCreateEmptyTextFile(this, '', this.shareName, context);
        } else {
            child = await askAndCreateChildDirectory(this, '', this.shareName, context);
        }
        AzureStorageFS.fireCreateEvent(child);
        return child;
    }
}

export interface IFileShareCreateChildContext extends IActionContext {
    childType: string;
    childName?: string;
}
