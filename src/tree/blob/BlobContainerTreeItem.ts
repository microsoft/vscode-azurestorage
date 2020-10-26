/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import * as azureStorageBlob from '@azure/storage-blob';
import * as fse from 'fs-extra';
import * as retry from 'p-retry';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProgressLocation, Uri } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, AzureTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, IParsedError, parseError, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from '../../AzureStorageFS';
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from '../../commands/azCopy/azCopyLocations';
import { azCopyTransfer } from '../../commands/azCopy/azCopyTransfer';
import { IExistingFileContext } from '../../commands/uploadFiles';
import { configurationSettingsKeys, getResourcesPath, NotificationProgress, staticWebsiteContainerName } from "../../constants";
import { ext } from "../../extensionVariables";
import { TransferProgress } from '../../TransferProgress';
import { createBlobContainerClient, createChildAsNewBlockBlob, IBlobContainerCreateChildContext, loadMoreBlobChildren } from '../../utils/blobUtils';
import { throwIfCanceled } from '../../utils/errorUtils';
import { localize } from '../../utils/localize';
import { getWorkspaceSetting } from '../../utils/settingsUtils';
import { getUploadingMessageWithSource, uploadLocalFolder } from '../../utils/uploadUtils';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { BlobContainerGroupTreeItem } from "./BlobContainerGroupTreeItem";
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";
import { BlobTreeItem } from './BlobTreeItem';

export enum ChildType {
    newBlockBlob,
    uploadedBlob
}

export class BlobContainerTreeItem extends AzureParentTreeItem<IStorageRoot> implements ICopyUrl {
    private _continuationToken: string | undefined;
    private _websiteHostingEnabled: boolean;
    private _openInFileExplorerString: string = 'Open in File Explorer...';

    private constructor(
        parent: BlobContainerGroupTreeItem,
        public readonly container: azureStorageBlob.ContainerItem) {
        super(parent);
    }

    public static async createBlobContainerTreeItem(parent: BlobContainerGroupTreeItem, container: azureStorageBlob.ContainerItem): Promise<BlobContainerTreeItem> {
        const ti = new BlobContainerTreeItem(parent, container);
        // Get static website status to display the appropriate icon
        await ti.refreshImpl();
        return ti;
    }

    public get iconPath(): { light: string | Uri; dark: string | Uri } {
        // tslint:disable-next-line:no-non-null-assertion
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

        let { children, continuationToken } = await loadMoreBlobChildren(this, this._continuationToken);
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
        //tslint:disable-next-line:no-non-null-assertion
        const hostingStatus = await (<StorageAccountTreeItem>this!.parent!.parent).getActualWebsiteHostingStatus();
        this._websiteHostingEnabled = hostingStatus.enabled;
    }

    private async listAllBlobs(cancellationToken?: vscode.CancellationToken, properties?: TelemetryProperties): Promise<azureStorageBlob.BlobItem[]> {
        let currentToken: string | undefined;
        let response: AsyncIterableIterator<azureStorageBlob.ContainerListBlobFlatSegmentResponse>;
        let responseValue: azureStorageBlob.ListBlobsFlatSegmentResponse;
        const blobs: azureStorageBlob.BlobItem[] = [];
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.root, this.container.name);

        ext.outputChannel.appendLog(`Querying Azure... Method: listBlobsFlat blobContainerName: "${this.container.name}" prefix: ""`);

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            throwIfCanceled(cancellationToken, properties, "listAllBlobs");
            response = containerClient.listBlobsFlat().byPage({ continuationToken: currentToken, maxPageSize: 5000 });

            // tslint:disable-next-line: no-unsafe-any
            responseValue = (await response.next()).value;

            blobs.push(...responseValue.segment.blobItems);
            currentToken = responseValue.continuationToken;
            if (!currentToken) {
                break;
            }
        }

        return blobs;
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete blob container '${this.label}' and all its contents?`;
        const result = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.root, this.container.name);
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
        } else if (context.childName && context.childType === BlobDirectoryTreeItem.contextValue) {
            child = new BlobDirectoryTreeItem(this, context.childName, this.container);
        } else {
            child = await createChildAsNewBlockBlob(this, context);
        }

        AzureStorageFS.fireCreateEvent(child);
        return child;
    }

    public async copyUrl(): Promise<void> {
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.root, this.container.name);
        let url: string = containerClient.url;
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLog(`Container URL copied to clipboard: ${url}`);
    }

    public async deployStaticWebsite(context: IActionContext, sourceFolderPath: string): Promise<void> {
        let destBlobFolder = "";
        let webEndpoint = await vscode.window.withProgress(
            {
                cancellable: true,
                location: ProgressLocation.Notification,
                title: `Deploying to ${this.friendlyContainerName} from ${sourceFolderPath}`,

            },
            async (notificationProgress, cancellationToken) => await this.deployStaticWebsiteCore(context, sourceFolderPath, destBlobFolder, notificationProgress, cancellationToken),
        );

        let browseWebsite: vscode.MessageItem = { title: "Browse to website" };
        vscode.window.showInformationMessage(
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
    // tslint:disable-next-line: max-func-body-length
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
                    let blobsToDelete: azureStorageBlob.BlobItem[] = [];
                    blobsToDelete = await this.listAllBlobs(cancellationToken);

                    if (blobsToDelete.length) {
                        let message = `The storage container "${this.friendlyContainerName}" contains ${blobsToDelete.length} files. Deploying will delete all of these existing files.  Continue?`;
                        let deleteAndDeploy: vscode.MessageItem = { title: 'Delete and Deploy' };
                        const result = await vscode.window.showWarningMessage(message, { modal: true }, deleteAndDeploy, DialogResponses.cancel);
                        if (result !== deleteAndDeploy) {
                            context.telemetry.properties.cancelStep = 'AreYouSureYouWantToDeleteExistingBlobs';
                            throw new UserCancelledError();
                        }
                    }

                    // Delete existing blobs
                    let transferProgress = new TransferProgress('blobs', blobsToDelete.length, 'Deleting');
                    await this.deleteBlobs(blobsToDelete, transferProgress, notificationProgress, cancellationToken, context.telemetry.properties);

                    // Reset notification progress. Otherwise the progress bar will remain full when uploading blobs
                    notificationProgress.report({ increment: -1 });
                }

                // Upload files as blobs
                await uploadLocalFolder(context, this, sourceFolderPath, destBlobFolder, notificationProgress, cancellationToken, 'Uploading', false);
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

        let webEndpoint = this.getPrimaryWebEndpoint();
        if (!webEndpoint) {
            throw new Error(`Could not obtain the primary web endpoint for ${this.root.storageAccountName}`);
        }

        ext.outputChannel.appendLog(`Deployment to static website complete. Primary web endpoint is ${webEndpoint}`);

        return webEndpoint;
    }

    public getPrimaryWebEndpoint(): string | undefined {
        // Right now only one web endpoint is supported per storage account
        // tslint:disable-next-line:strict-boolean-expressions
        return this.root.primaryEndpoints && this.root.primaryEndpoints.web;
    }

    public getStorageAccountTreeItem(treeItem: AzureTreeItem): StorageAccountTreeItem {
        if (!(treeItem instanceof BlobContainerTreeItem)) {
            throw new Error(`Unexpected treeItem type: ${treeItem.contextValue}`);
        }

        let storageAccountTreeItem = treeItem.parent && treeItem.parent.parent;
        if (storageAccountTreeItem && storageAccountTreeItem instanceof StorageAccountTreeItem) {
            return storageAccountTreeItem;
        } else {
            throw new Error("Internal error: Couldn't find storage account treeItem for container");
        }
    }

    private async deleteBlobs(
        blobsToDelete: azureStorageBlob.BlobItem[],
        transferProgress: TransferProgress,
        notificationProgress: NotificationProgress,
        cancellationToken: vscode.CancellationToken,
        properties: TelemetryProperties,
    ): Promise<void> {
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.root, this.container.name);
        for (let blobIndex of blobsToDelete.keys()) {
            let blob: azureStorageBlob.BlobItem = blobsToDelete[blobIndex];
            try {
                ext.outputChannel.appendLog(`Deleting blob "${blob.name}"...`);
                let response: azureStorageBlob.BlobDeleteResponse = await containerClient.deleteBlob(blob.name);
                if (cancellationToken.isCancellationRequested) {
                    throw new UserCancelledError();
                } else if (response.errorCode) {
                    throw new Error(response.errorCode);
                } else {
                    transferProgress.reportToNotification(blobIndex, notificationProgress);
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
        ext.outputChannel.appendLog(getUploadingMessageWithSource(filePath, this.label));
        const src: ILocalLocation = createAzCopyLocalLocation(filePath);
        const dst: IRemoteSasLocation = createAzCopyRemoteLocation(this, blobPath);
        // tslint:disable-next-line: strict-boolean-expressions
        const totalBytes: number = (await fse.stat(filePath)).size || 1;
        const transferProgress: TransferProgress = new TransferProgress('bytes', totalBytes, blobPath);
        await azCopyTransfer(context, 'LocalBlob', src, dst, transferProgress, notificationProgress, cancellationToken);
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
