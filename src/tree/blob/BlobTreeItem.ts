/*
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
**/

import type { AccountSASSignatureValues, BlobClient, BlobGetPropertiesResponse, BlockBlobClient, ContainerItem } from "@azure/storage-blob";

import { polyfill } from '../../polyfill.worker';
polyfill();

import { AccountSASPermissions } from '@azure/storage-blob';

import { AzExtTreeItem, AzureWizard, DeleteConfirmationStep, IActionContext, TreeItemIconPath } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureStorageFS } from "../../AzureStorageFS";
import { DeleteBlobStep } from "../../commands/deleteBlob/DeleteBlobStep";
import { IDeleteBlobWizardContext } from "../../commands/deleteBlob/IDeleteBlobWizardContext";
import { storageExplorerDownloadUrl, threeDaysInMS } from "../../constants";
import { createActivityContext } from "../../utils/activityUtils";
import { askOpenInStorageExplorer } from "../../utils/askOpenInStorageExplorer";
import { createBlobClient, createBlockBlobClient } from '../../utils/blobUtils';
import { copyAndShowToast } from "../../utils/copyAndShowToast";
import { localize } from "../../utils/localize";
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { ITransferSrcOrDstTreeItem } from "../ITransferSrcOrDstTreeItem";
import { BlobContainerTreeItem } from "./BlobContainerTreeItem";
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";

export class BlobTreeItem extends AzExtTreeItem implements ICopyUrl, ITransferSrcOrDstTreeItem {
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

    constructor(parent: BlobContainerTreeItem | BlobDirectoryTreeItem,
        blobPath: string,
        public readonly container: ContainerItem,
        public readonly resourceUri: string
    ) {
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

    public get transferSasToken(): string {
        const accountSASSignatureValues: AccountSASSignatureValues = {
            expiresOn: new Date(Date.now() + threeDaysInMS),
            permissions: AccountSASPermissions.parse("rwl"), // read, write, list
            services: 'b', // blob
            resourceTypes: 'co' // container, object
        };
        return this.root.generateSasToken(accountSASSignatureValues);
    }

    public async copyUrl(): Promise<void> {
        // Use this.blobPath here instead of this.blobName. Otherwise the blob's containing directory/directories aren't displayed
        const blobClient: BlobClient = await createBlobClient(this.root, this.container.name, this.blobPath);
        const url = blobClient.url;
        await copyAndShowToast(url, 'Blob URL');
    }

    public async deleteTreeItemImpl(context: ISuppressMessageContext): Promise<void> {
        if (!context.suppressMessage) {
            const deletingBlob: string = localize('deleteBlob', 'Delete blob "{0}"', this.label);
            const wizardContext: IDeleteBlobWizardContext = Object.assign(context, {
                blobName: this.label,
                blob: this,
                root: this.root,
                ...(await createActivityContext()),
                activityTitle: deletingBlob,
            });
            const message: string = localize('deleteBlob', "Are you sure you want to delete the blob '{0}'?", this.label);
            const wizard = new AzureWizard(wizardContext, {
                promptSteps: [new DeleteConfirmationStep(message)],
                executeSteps: [new DeleteBlobStep()]
            });
            await wizard.prompt();
            await wizard.execute();
        } else {
            const blobClient: BlobClient = await createBlobClient(this.root, this.container.name, this.blobPath);
            await blobClient.delete();
        }
        AzureStorageFS.fireDeleteEvent(this);
    }

    public async checkCanDownload(context: IActionContext): Promise<void> {
        const client: BlockBlobClient = await createBlockBlobClient(this.root, this.container.name, this.blobPath);
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
