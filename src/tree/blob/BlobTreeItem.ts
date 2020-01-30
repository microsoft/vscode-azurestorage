/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.md in the project root for license information.
  **/

import * as azureStorageBlob from "@azure/storage-blob";
import { BlobGetPropertiesResponse, BlockBlobClient } from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem, SaveDialogOptions, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from "../../AzureStorageFS";
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { createBlobClient, createBlockBlobClient, TransferProgress } from '../../utils/blobUtils';
import { Limits } from "../../utils/limits";
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

    constructor(parent: AzureParentTreeItem, blobPath: string, public readonly container: azureStorageBlob.ContainerItem, public readonly label: string = '') {
        super(parent);
        this.blobPath = blobPath;
        this.blobName = path.basename(blobPath);
        this.label = label || this.blobName;
    }

    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'document.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'document.svg')
    };

    public async copyUrl(): Promise<void> {
        // Use this.blobPath here instead of this.blobName. Otherwise the blob's containing directory/directories aren't displayed
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(this.root, this.container.name, this.blobPath);
        const url = blobClient.url;
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
        await this.checkCanDownload();

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
            const linkablePath: Uri = Uri.file(uri.fsPath); // Allows CTRL+Click in Output panel
            const blockBlobClient: BlockBlobClient = createBlockBlobClient(this.root, this.container.name, this.blobPath);

            // tslint:disable-next-line: strict-boolean-expressions
            const totalBytes: number = (await blockBlobClient.getProperties()).contentLength || 1;

            ext.outputChannel.show();
            ext.outputChannel.appendLine(`Downloading ${this.blobName} to ${uri.fsPath}...`);

            await window.withProgress({ title: `Downloading ${this.blobName}`, location: vscode.ProgressLocation.Notification }, async (notificationProgress) => {
                const transferProgress: TransferProgress = new TransferProgress();
                await blockBlobClient.downloadToFile(uri.fsPath, undefined, undefined, {
                    onProgress: (transferProgressEvent) => transferProgress.reportToNotification(this.blobName, transferProgressEvent.loadedBytes, totalBytes, notificationProgress)
                });
            });

            ext.outputChannel.appendLine(`Successfully downloaded ${linkablePath}.`);
        }
    }

    private async checkCanDownload(): Promise<void> {
        let message: string | undefined;

        const client: BlockBlobClient = createBlockBlobClient(this.root, this.container.name, this.blobPath);
        let props: BlobGetPropertiesResponse = await client.getProperties();

        if (Number(props.contentLength) > Limits.maxUploadDownloadSizeBytes) {
            message = `Please use Storage Explorer for blobs larger than ${Limits.maxUploadDownloadSizeMB}MB.`;
        } else if (props.blobType && !props.blobType.toLocaleLowerCase().startsWith("block")) {
            message = `Please use Storage Explorer for blobs of type '${props.blobType}'.`;
        }

        if (message) {
            await Limits.askOpenInStorageExplorer(message, this.root.storageAccount.id, this.root.subscriptionId, 'Azure.BlobContainer', this.container.name);
        }
    }
}

export interface ISuppressMessageContext extends IActionContext {
    suppressMessage: boolean;
}
