/*
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
**/

import * as azureStorageBlob from "@azure/storage-blob";
import { BlobGetPropertiesResponse, BlockBlobClient } from "@azure/storage-blob";
import { AzExtTreeItem, DialogResponses, IActionContext, TreeItemIconPath, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { MessageItem, window } from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { storageExplorerDownloadUrl } from "../../constants";
import { askOpenInStorageExplorer } from "../../utils/askOpenInStorageExplorer";
import { createBlobClient, createBlockBlobClient } from '../../utils/blobUtils';
import { copyAndShowToast } from "../../utils/copyAndShowToast";
import { localize } from "../../utils/localize";
import { ICopyUrl } from '../ICopyUrl';
import { IDownloadableTreeItem } from "../IDownloadableTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem } from "./BlobContainerTreeItem";
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";

export class BlobTreeItem extends AzExtTreeItem implements ICopyUrl, IDownloadableTreeItem {
    public static contextValue: string = 'azureBlobFile';
    public contextValue: string = BlobTreeItem.contextValue;
    public parent: BlobContainerTreeItem | BlobDirectoryTreeItem;

    /**
     * The name (and only the name) of the directory
     */
    public readonly blobName: string;

    /**
     * The full path of the blob within the container.
     */
    public readonly blobPath: string;

    constructor(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, blobPath: string, public readonly container: azureStorageBlob.ContainerItem) {
        super(parent);
        this.commandId = 'azureStorage.editBlob';
        this.blobPath = blobPath;
        this.blobName = path.basename(blobPath);
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public get remoteFilePath(): string {
        return this.blobPath;
    }

    public get label(): string {
        return this.blobName;
    }

    public get iconPath(): TreeItemIconPath {
        return new vscode.ThemeIcon('file');
    }

    public async copyUrl(): Promise<void> {
        // Use this.blobPath here instead of this.blobName. Otherwise the blob's containing directory/directories aren't displayed
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(this.root, this.container.name, this.blobPath);
        const url = blobClient.url;
        await copyAndShowToast(url, 'Blob URL');
    }

    public async deleteTreeItemImpl(context: ISuppressMessageContext): Promise<void> {
        let result: MessageItem | undefined;
        if (!context.suppressMessage) {
            const message: string = `Are you sure you want to delete the blob '${this.label}'?`;
            result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        }
        if (result === DialogResponses.deleteResponse || context.suppressMessage) {
            const blobClient: azureStorageBlob.BlobClient = createBlobClient(this.root, this.container.name, this.blobPath);
            await blobClient.delete();
        } else {
            throw new UserCancelledError();
        }

        AzureStorageFS.fireDeleteEvent(this);
    }

    public async checkCanDownload(context: IActionContext): Promise<void> {
        const client: BlockBlobClient = createBlockBlobClient(this.root, this.container.name, this.blobPath);
        const props: BlobGetPropertiesResponse = await client.getProperties();
        context.telemetry.measurements.blobDownloadSize = props.contentLength;
        if (props.blobType && !props.blobType.toLocaleLowerCase().startsWith("block")) {
            context.telemetry.properties.invalidBlobTypeForDownload = 'true';
            const message: string = localize('pleaseUseSE', 'Please use [Storage Explorer]({0}) for blobs of type "{1}".', storageExplorerDownloadUrl, props.blobType);
            askOpenInStorageExplorer(context, message, this.root.storageAccountId, this.subscription.subscriptionId, 'Azure.BlobContainer', this.container.name);
        }
    }
}

export interface ISuppressMessageContext extends IActionContext {
    suppressMessage: boolean;
}
