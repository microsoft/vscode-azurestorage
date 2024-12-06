/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccountSASSignatureValues, BlobDeleteResponse, BlobItem, ContainerClient, ContainerItem, ContainerListBlobFlatSegmentResponse, ListBlobsFlatSegmentResponse } from '@azure/storage-blob';

import { polyfill } from '../../polyfill.worker';
polyfill();

import { AccountSASPermissions } from '@azure/storage-blob';

import { AzExtParentTreeItem, AzExtTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, IParsedError, TelemetryProperties, UserCancelledError, parseError } from '@microsoft/vscode-azext-utils';
import * as retry from 'p-retry';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProgressLocation, Uri } from 'vscode';
import { AzureStorageFS } from '../../AzureStorageFS';
import { TransferProgress } from '../../TransferProgress';
import { UploadItem, uploadFile } from '../../commands/transfers/transfers';
import { IExistingFileContext } from '../../commands/uploadFiles/IExistingFileContext';
import { NotificationProgress, configurationSettingsKeys, getResourcesPath, staticWebsiteContainerName, threeDaysInMS } from "../../constants";
import { ext } from "../../extensionVariables";
import { IBlobContainerCreateChildContext, createBlobContainerClient, createChildAsNewBlockBlob, loadMoreBlobChildren } from '../../utils/blobUtils';
import { copyAndShowToast } from '../../utils/copyAndShowToast';
import { throwIfCanceled } from '../../utils/errorUtils';
import { localize } from '../../utils/localize';
import { getWorkspaceSetting } from '../../utils/settingsUtils';
import { uploadLocalFolder } from '../../utils/uploadUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from '../IStorageRoot';
import { ITransferSrcOrDstTreeItem } from '../ITransferSrcOrDstTreeItem';
import { ResolvedStorageAccountTreeItem, StorageAccountTreeItem, isResolvedStorageAccountTreeItem } from "../StorageAccountTreeItem";
import { BlobContainerGroupTreeItem } from "./BlobContainerGroupTreeItem";
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";
import { BlobTreeItem } from './BlobTreeItem';

export enum ChildType {
    newBlockBlob,
    uploadedBlob
}

export class BlobContainerTreeItem extends AzExtParentTreeItem implements ICopyUrl, ITransferSrcOrDstTreeItem {
    private _continuationToken: string | undefined;
    private _websiteHostingEnabled: boolean;
    private _openInFileExplorerString: string = 'Open in Explorer...';
    public parent: BlobContainerGroupTreeItem;

    private constructor(
        parent: BlobContainerGroupTreeItem,
        public readonly container: ContainerItem) {
        super(parent);
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public get remoteFilePath(): string {
        return '';
    }

    public get resourceUri(): string {
        const containerClient: ContainerClient = this.root.createBlobServiceClient().getContainerClient(this.container.name);
        return containerClient.url;
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

    public static async createBlobContainerTreeItem(parent: BlobContainerGroupTreeItem, container: ContainerItem): Promise<BlobContainerTreeItem> {
        const ti = new BlobContainerTreeItem(parent, container);
        // Get static website status to display the appropriate icon
        await ti.refreshImpl();
        return ti;
    }

    public get iconPath(): { light: string | Uri; dark: string | Uri } {
        const iconFileName = this._websiteHostingEnabled && this.container.name === staticWebsiteContainerName ?
            'BrandAzureStaticWebsites' : 'AzureBlobContainer';
        return {
            light: path.join(getResourcesPath(), 'light', `${iconFileName}.svg`),
            dark: path.join(getResourcesPath(), 'dark', `${iconFileName}.svg`)
        };
    }

    public label: string = this.container.name;
    public static contextValue: string = 'azureBlobContainer';
    public contextValue: string = BlobContainerTreeItem.contextValue;

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        const result: AzExtTreeItem[] = [];
        if (clearCache) {
            this._continuationToken = undefined;
            const ti = new GenericTreeItem(this, {
                label: this._openInFileExplorerString,
                commandId: 'azureStorage.openInFileExplorer',
                contextValue: 'openInFileExplorer'
            });

            ti.commandArgs = [this];
            result.push(ti);
        }

        const { children, continuationToken } = await loadMoreBlobChildren(this, this._continuationToken);
        this._continuationToken = continuationToken;
        return result.concat(children);
    }

    public compareChildrenImpl(ti1: BlobContainerTreeItem, ti2: BlobContainerTreeItem): number {
        if (ti1.label === this._openInFileExplorerString) {
            return -1;
        } else if (ti2.label === this._openInFileExplorerString) {
            return 1;
        }

        return ti1.label.localeCompare(ti2.label);
    }

    public async refreshImpl(): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const hostingStatus = await (<StorageAccountTreeItem>this!.parent!.parent).getActualWebsiteHostingStatus();
        this._websiteHostingEnabled = hostingStatus.enabled;
    }

    private async listAllBlobs(cancellationToken?: vscode.CancellationToken, properties?: TelemetryProperties): Promise<BlobItem[]> {
        let currentToken: string | undefined;
        let response: AsyncIterableIterator<ContainerListBlobFlatSegmentResponse>;
        let responseValue: ListBlobsFlatSegmentResponse;
        const blobs: BlobItem[] = [];
        const containerClient: ContainerClient = createBlobContainerClient(this.root, this.container.name);

        ext.outputChannel.appendLog(`Querying Azure... Method: listBlobsFlat blobContainerName: "${this.container.name}" prefix: ""`);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            throwIfCanceled(cancellationToken, properties, "listAllBlobs");
            response = containerClient.listBlobsFlat().byPage({ continuationToken: currentToken, maxPageSize: 5000 });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            responseValue = (await response.next()).value;

            blobs.push(...responseValue.segment.blobItems);
            currentToken = responseValue.continuationToken;
            if (!currentToken) {
                break;
            }
        }

        return blobs;
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const message: string = `Are you sure you want to delete blob container '${this.label}' and all its contents?`;
        const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const containerClient: ContainerClient = createBlobContainerClient(this.root, this.container.name);
            await containerClient.delete();
        }

        AzureStorageFS.fireDeleteEvent(this);
    }

    public async createChildImpl(context: ICreateChildImplContext & Partial<IExistingFileContext> & IBlobContainerCreateChildContext): Promise<AzExtTreeItem> {
        let child: AzExtTreeItem;
        if (context.remoteFilePath && context.localFilePath) {
            context.showCreatingTreeItem(context.remoteFilePath);
            await this.uploadLocalFile(context, context.localFilePath, context.remoteFilePath);
            child = new BlobTreeItem(this, context.remoteFilePath, this.container);
        } else if ((context.childName !== undefined) && context.childType === BlobDirectoryTreeItem.contextValue) {
            child = new BlobDirectoryTreeItem(this, context.childName, this.container);
        } else {
            child = await createChildAsNewBlockBlob(this, context);
        }

        AzureStorageFS.fireCreateEvent(child);
        return child;
    }

    public getUrl(): string {
        const containerClient: ContainerClient = createBlobContainerClient(this.root, this.container.name);
        return containerClient.url;
    }

    public async copyUrl(): Promise<void> {
        const url: string = this.getUrl();
        await copyAndShowToast(url, 'Container URL');
    }

    public async deployStaticWebsite(context: IActionContext, sourceFolderPath: string): Promise<void> {
        const destBlobFolder = "";
        const webEndpoint = await vscode.window.withProgress(
            {
                cancellable: true,
                location: ProgressLocation.Notification,
                title: `Deploying to ${this.friendlyContainerName} from ${sourceFolderPath}`,

            },
            async (notificationProgress, cancellationToken) => await this.deployStaticWebsiteCore(context, sourceFolderPath, destBlobFolder, notificationProgress, cancellationToken),
        );

        const browseWebsite: vscode.MessageItem = { title: "Browse to website" };
        void vscode.window.showInformationMessage(
            `Deployment complete. The primary web endpoint is ${webEndpoint}`,
            browseWebsite
        ).then(async (result) => {
            if (result === browseWebsite) {
                await vscode.commands.executeCommand('azureStorage.browseStaticWebsite', this);
            }
        });
    }

    private get friendlyContainerName(): string {
        return `${this.root.storageAccountName}/${this.container.name}`;
    }

    /**
     * deployStaticWebsiteCore
     *
     * @returns The primary web endpoint
     */
    private async deployStaticWebsiteCore(
        context: IActionContext,
        sourceFolderPath: string,
        destBlobFolder: string,
        notificationProgress: NotificationProgress,
        cancellationToken: vscode.CancellationToken
    ): Promise<string> {
        ext.outputChannel.appendLog(localize('deploying', 'Deploying to static website "{0}/{1}"', this.root.storageAccountId, this.container.name));
        const retries: number = 4;
        await retry(
            async (currentAttempt) => {
                context.telemetry.properties.deployAttempt = currentAttempt.toString();
                if (currentAttempt > 1) {
                    const message: string = localize('retryingDeploy', 'Retrying deploy (Attempt {0}/{1})...', currentAttempt, retries + 1);
                    ext.outputChannel.appendLog(message);
                }

                if (getWorkspaceSetting<boolean>(configurationSettingsKeys.deleteBeforeDeploy)) {
                    // Find existing blobs
                    let blobsToDelete: BlobItem[] = [];
                    blobsToDelete = await this.listAllBlobs(cancellationToken);

                    if (blobsToDelete.length) {
                        const message = `The storage container "${this.friendlyContainerName}" contains ${blobsToDelete.length} files. Deploying will delete all of these existing files.  Continue?`;
                        const deleteAndDeploy: vscode.MessageItem = { title: 'Delete and Deploy' };
                        const result = await vscode.window.showWarningMessage(message, { modal: true }, deleteAndDeploy, DialogResponses.cancel);
                        if (result !== deleteAndDeploy) {
                            context.telemetry.properties.cancelStep = 'AreYouSureYouWantToDeleteExistingBlobs';
                            throw new UserCancelledError();
                        }
                    }

                    // Delete existing blobs
                    const transferProgress = new TransferProgress('blobs', 'Deleting');
                    await this.deleteBlobs(blobsToDelete, transferProgress, notificationProgress, cancellationToken, context.telemetry.properties);

                    // Reset notification progress. Otherwise the progress bar will remain full when uploading blobs
                    notificationProgress.report({ increment: -1 });
                }

                // Upload files as blobs
                await uploadLocalFolder(context, this, sourceFolderPath, destBlobFolder, notificationProgress, cancellationToken, 'Uploading');
            },
            {
                retries,
                minTimeout: 2 * 1000,
                onFailedAttempt: error => {
                    const parsedError: IParsedError = parseError(error);
                    if (/server failed to authenticate/i.test(parsedError.message)) {
                        // Only retry if we see this error
                        return;
                    } else if (parsedError.isUserCancelledError) {
                        ext.outputChannel.appendLog("Deployment canceled.");
                    }
                    throw error;
                }
            }
        );

        const webEndpoint = this.getPrimaryWebEndpoint();
        if (!webEndpoint) {
            throw new Error(`Could not obtain the primary web endpoint for ${this.root.storageAccountName}`);
        }

        ext.outputChannel.appendLog(`Deployment to static website complete. Primary web endpoint is ${webEndpoint}`);

        return webEndpoint;
    }

    public getPrimaryWebEndpoint(): string | undefined {
        // Right now only one web endpoint is supported per storage account
        return this.root.primaryEndpoints && this.root.primaryEndpoints.web;
    }

    public getStorageAccountTreeItem(treeItem: AzExtTreeItem): ResolvedStorageAccountTreeItem & AzExtTreeItem {
        if (!(treeItem instanceof BlobContainerTreeItem)) {
            throw new Error(`Unexpected treeItem type: ${treeItem.contextValue}`);
        }

        const storageAccountTreeItem = treeItem.parent && treeItem.parent.parent;
        if (storageAccountTreeItem && isResolvedStorageAccountTreeItem(storageAccountTreeItem)) {
            return storageAccountTreeItem;
        } else {
            throw new Error("Internal error: Couldn't find storage account treeItem for container");
        }
    }

    private async deleteBlobs(
        blobsToDelete: BlobItem[],
        transferProgress: TransferProgress,
        notificationProgress: NotificationProgress,
        cancellationToken: vscode.CancellationToken,
        properties: TelemetryProperties,
    ): Promise<void> {
        const containerClient: ContainerClient = createBlobContainerClient(this.root, this.container.name);
        for (const blobIndex of blobsToDelete.keys()) {
            const blob: BlobItem = blobsToDelete[blobIndex];
            try {
                ext.outputChannel.appendLog(`Deleting blob "${blob.name}"...`);
                const response: BlobDeleteResponse = await containerClient.deleteBlob(blob.name);
                if (cancellationToken.isCancellationRequested) {
                    throw new UserCancelledError();
                } else if (response.errorCode) {
                    throw new Error(response.errorCode);
                } else {
                    transferProgress.reportToNotification(blobIndex, blobsToDelete.length, notificationProgress);
                }
            } catch (error) {
                if (parseError(error).isUserCancelledError) {
                    properties.cancelStep = "deleteBlobs";
                    throw error;
                }

                throw new Error(`Error deleting blob "${blob.name}" : ${parseError(error).message}`);
            }
        }
    }

    public async uploadLocalFile(
        context: IActionContext,
        filePath: string,
        blobPath: string,
        notificationProgress?: NotificationProgress,
        cancellationToken?: vscode.CancellationToken
    ): Promise<void> {
        const uploadItem: UploadItem = {
            type: "blob",
            localFilePath: filePath,
            resourceName: this.container.name,
            resourceUri: this.resourceUri,
            remoteFilePath: blobPath,
            transferSasToken: this.transferSasToken,
        };
        await uploadFile(context, uploadItem, notificationProgress, cancellationToken);
    }

    public static validateBlobName(name: string): string | undefined | null {
        if (!name) {
            return "Blob name cannot be empty";
        }
        if (name.length < 1 || name.length > 1024) {
            return 'Blob name must contain between 1 and 1024 characters';
        }
        if (/[/\\.]$/.test(name)) {
            return 'Avoid blob names that end with a forward or backward slash or a period.';
        }

        return undefined;
    }
}
