/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.md in the project root for license information.
  **/

import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem, SaveDialogOptions, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from "../../AzureStorageFS";
import { getResourcesPath } from "../../constants";
import { BlobFileHandler } from '../../editors/BlobFileHandler';
import { ext } from "../../extensionVariables";
import { createBlobClient, createBlobContainerClient } from '../../utils/blobUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";

export class BlobTreeItem extends AzureTreeItem<IStorageRoot> implements ICopyUrl {
    public static contextValue: string = 'azureBlob';
    public contextValue: string = BlobTreeItem.contextValue;
    public commandId: string = 'azureStorage.editBlob';

    /**
     * The name (and only the name) of the directory
     */
    public readonly blobName: string;

    /**
     * The full path of the blob within the container.
     */
    public readonly blobPath: string;

    constructor(parent: AzureParentTreeItem, blobPath: string, public readonly container: azureStorageBlob.ContainerItem) {
        super(parent);
        this.blobPath = blobPath;
        this.blobName = path.basename(blobPath);
    }

    public get label(): string {
        return this.blobName;
    }

    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'document.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'document.svg')
    };

    public async copyUrl(): Promise<void> {
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.root, this.container.name);
        let url: string = containerClient.url;
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Blob URL copied to clipboard: ${url}`);
    }

    public async deleteTreeItemImpl(context: ISuppressMessageContext): Promise<void> {
        let result: MessageItem | undefined;
        if (!context.suppressMessage) {
            const message: string = `Are you sure you want to delete the blob '${this.label}'?`;
            result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        }
        if (result === DialogResponses.deleteResponse || context.suppressMessage) {
            let blobClient: azureStorageBlob.BlobClient = createBlobClient(this.root, this.container.name, this.blobPath);
            await blobClient.delete();
        } else {
            throw new UserCancelledError();
        }

        AzureStorageFS.fireDeleteEvent(this);
    }

    public async download(): Promise<void> {
        const handler = new BlobFileHandler();
        await handler.checkCanDownload(this);

        const extension = path.extname(this.blobName);
        const filters = {
            "All files": ['*']
        };
        if (extension) {
            // This is needed to ensure the file extension is added in the Save dialog, since the filename will be displayed without it by default on Windows
            filters[`*${extension}`] = [extension];
        }

        const uri: Uri | undefined = await window.showSaveDialog(<SaveDialogOptions>{
            saveLabel: "Download",
            filters,
            defaultUri: Uri.file(this.blobName)
        });
        if (uri && uri.scheme === 'file') {
            await handler.downloadFile(this, uri.fsPath);
        }
    }
}

export interface ISuppressMessageContext extends IActionContext {
    suppressMessage: boolean;
}
