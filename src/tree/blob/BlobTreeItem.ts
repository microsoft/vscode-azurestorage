/*
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
**/

import * as azureStorageBlob from "@azure/storage-blob";
import { BlobGetPropertiesResponse, BlockBlobClient } from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from "../../AzureStorageFS";
import { getResourcesPath, storageExplorerDownloadUrl } from "../../constants";
import { ext } from "../../extensionVariables";
import { askOpenInStorageExplorer } from "../../utils/askOpenInStorageExplorer";
import { createBlobClient, createBlockBlobClient } from '../../utils/blobUtils';
import { localize } from "../../utils/localize";
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
        // Use this.blobPath here instead of this.blobName. Otherwise the blob's containing directory/directories aren't displayed
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(this.root, this.container.name, this.blobPath);
        const url = blobClient.url;
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLog(`Blob URL copied to clipboard: ${url}`);
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

    public async checkCanDownload(context: IActionContext): Promise<void> {
        const client: BlockBlobClient = createBlockBlobClient(this.root, this.container.name, this.blobPath);
        let props: BlobGetPropertiesResponse = await client.getProperties();
        context.telemetry.measurements.blobDownloadSize = props.contentLength;
        if (props.blobType && !props.blobType.toLocaleLowerCase().startsWith("block")) {
            context.telemetry.properties.invalidBlobTypeForDownload = 'true';
            const message: string = localize('pleaseUseSE', 'Please use [Storage Explorer]({0}) for blobs of type "{1}".', storageExplorerDownloadUrl, props.blobType);
            await askOpenInStorageExplorer(context, message, this.root.storageAccountId, this.root.subscriptionId, 'Azure.BlobContainer', this.container.name);
        }
    }
}

export interface ISuppressMessageContext extends IActionContext {
    suppressMessage: boolean;
}
