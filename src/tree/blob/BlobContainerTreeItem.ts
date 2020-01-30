/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TransferProgressEvent } from '@azure/core-http';
import * as azureStorageBlob from '@azure/storage-blob';
import * as fse from 'fs-extra';
import * as glob from 'glob';
import * as mime from 'mime';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProgressLocation, Uri } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, AzureTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, parseError, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import { AzureStorageFS } from '../../AzureStorageFS';
import { getResourcesPath, staticWebsiteContainerName } from "../../constants";
import { ext } from "../../extensionVariables";
import { createBlobContainerClient, createBlockBlobClient, createChildAsNewBlockBlob, doesBlobExist, IBlobContainerCreateChildContext, loadMoreBlobChildren, TransferProgress } from '../../utils/blobUtils';
import { Limits } from '../../utils/limits';
import { ICopyUrl } from '../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { StorageAccountTreeItem } from "../StorageAccountTreeItem";
import { BlobContainerGroupTreeItem } from "./BlobContainerGroupTreeItem";
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";
import { BlobTreeItem } from './BlobTreeItem';

let lastUploadFolder: Uri;

export enum ChildType {
    newBlockBlob,
    uploadedBlob
}

export interface IExistingBlobContext extends IActionContext {
    filePath: string;
    blobPath: string;
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
            this.throwIfCanceled(cancellationToken, properties, "listAllBlobs");
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

    public async createChildImpl(context: ICreateChildImplContext & Partial<IExistingBlobContext> & IBlobContainerCreateChildContext): Promise<AzExtTreeItem> {
        let child: AzExtTreeItem;
        if (context.blobPath && context.filePath) {
            context.showCreatingTreeItem(context.blobPath);
            await this.uploadFileToBlockBlob(context.filePath, context.blobPath);
            child = new BlobTreeItem(this, context.blobPath, this.container);
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
        ext.outputChannel.appendLine(`Container URL copied to clipboard: ${url}`);
    }

    // This is the public entrypoint for azureStorage.uploadBlockBlob
    public async uploadBlockBlob(context: IActionContext): Promise<void> {
        let uris = await vscode.window.showOpenDialog(
            <vscode.OpenDialogOptions>{
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                defaultUri: lastUploadFolder,
                filters: {
                    "Text files": [
                        'csv',
                        'json',
                        'log',
                        'md',
                        'rtf',
                        'txt',
                        'text',
                        'xml',
                    ],
                    "All files": ['*']
                },
                openLabel: "Upload"
            }
        );
        if (uris && uris.length) {
            let uri = uris[0];
            lastUploadFolder = uri;
            let filePath = uri.fsPath;

            await this.checkCanUpload(filePath);

            let blobPath = await vscode.window.showInputBox({
                prompt: 'Enter a name for the uploaded block blob (may include a path)',
                value: path.basename(filePath),
                validateInput: BlobContainerTreeItem.validateBlobName
            });
            if (blobPath) {
                if (await doesBlobExist(this, blobPath)) {
                    const result = await vscode.window.showWarningMessage(
                        `A blob with the name "${blobPath}" already exists. Do you want to overwrite it?`,
                        { modal: true },
                        DialogResponses.yes, DialogResponses.cancel);
                    if (result !== DialogResponses.yes) {
                        throw new UserCancelledError();
                    }

                    let blobId = `${this.fullId}/${blobPath}`;
                    try {
                        let blobTreeItem = await this.treeDataProvider.findTreeItem(blobId, context);
                        if (blobTreeItem) {
                            // A treeItem for this blob already exists, no need to do anything with the tree, just upload
                            await this.uploadFileToBlockBlob(filePath, blobPath);
                            return;
                        }
                    } catch (err) {
                        // https://github.com/Microsoft/vscode-azuretools/issues/85
                    }
                }

                await this.createChild(<IExistingBlobContext>{ ...context, blobPath, filePath });
            }
        }

        throw new UserCancelledError();
    }

    public async deployStaticWebsite(context: IActionContext, sourceFolderPath: string): Promise<void> {
        let destBlobFolder = "";
        let webEndpoint = await vscode.window.withProgress(
            {
                cancellable: true,
                location: ProgressLocation.Notification,
                title: `Deploying to ${this.friendlyContainerName} from ${sourceFolderPath}`,

            },
            async (progress, cancellationToken) => await this.deployStaticWebsiteCore(context, sourceFolderPath, destBlobFolder, progress, cancellationToken),
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
        return `${this.root.storageAccount.name}/${this.container.name}`;
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
        progress: vscode.Progress<{ message?: string, increment?: number }>,
        cancellationToken: vscode.CancellationToken
    ): Promise<string> {
        let properties = <TelemetryProperties & {
            blobsToDelete: number;
            filesToUpload: number;
            fileLengths: number[];
        }>context.telemetry.properties;

        try {
            properties.fileLengths = [];

            const isFolder = (file: string): boolean => file.endsWith("/");

            // Find existing blobs
            let blobsToDelete: azureStorageBlob.BlobItem[] = [];
            blobsToDelete = await this.listAllBlobs(cancellationToken);
            properties.blobsToDelete = blobsToDelete.length;

            if (blobsToDelete.length) {
                let message = `The storage container "${this.friendlyContainerName}" contains ${blobsToDelete.length} files. Deploying will delete all of these existing files.  Continue?`;
                let deleteAndDeploy: vscode.MessageItem = { title: 'Delete and Deploy' };
                const result = await vscode.window.showWarningMessage(message, { modal: true }, deleteAndDeploy, DialogResponses.cancel);
                if (result !== deleteAndDeploy) {
                    properties.cancelStep = 'AreYouSureYouWantToDeleteExistingBlobs';
                    throw new UserCancelledError();
                }
            }

            // ext.outputChannel.show();
            ext.outputChannel.appendLine(`Deploying to static website ${this.root.storageAccount.name}/${this.container.name}`);

            // Find source files
            // Note: glob always returns paths with '/' separator, even on Windows, which also is the main
            // separator used by Azure.
            let filePathsWithAzureSeparator = await new Promise<string[]>(
                (resolve, reject) => {
                    glob(
                        path.join(sourceFolderPath, '**'),
                        {
                            mark: true, // Add '/' to folders
                            dot: true, // Treat '.' as a normal character
                            nodir: true, // required for symlinks https://github.com/archiverjs/node-archiver/issues/311#issuecomment-445924055
                            follow: true, // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
                            ignore: path.join(sourceFolderPath, '.{git,vscode}/**')
                        },
                        (err, matches) => {
                            if (err) {
                                reject(err);
                            } else {
                                // Remove folders from source list
                                let files = matches.filter(file => !isFolder(file));

                                resolve(files);
                            }
                        });
                });
            properties.filesToUpload = filePathsWithAzureSeparator.length;

            // Set up progress indicator
            let totalWork = blobsToDelete.length + filePathsWithAzureSeparator.length;
            let completedPercentage = 0;
            let lastTimeReported: number;
            const msBetweenReports = 1000;
            const updateProgress = () => {
                // tslint:disable-next-line:strict-boolean-expressions
                let increment = 1 / (totalWork || 1) * 100;

                // Work-around for https://github.com/Microsoft/vscode/issues/50479
                if (!lastTimeReported || Date.now() > lastTimeReported + msBetweenReports) {
                    let message = `Deploying ${filePathsWithAzureSeparator.length} files to ${this.friendlyContainerName}`;
                    if (completedPercentage) {
                        message = `${message} (${completedPercentage.toFixed(0)}% complete)`;
                    }
                    progress.report({ message });
                    lastTimeReported = Date.now();
                }

                // Increment after so we can show an initial 0% message
                completedPercentage += increment;
            };

            // Show initial progress indication before any work
            updateProgress();

            // Delete existing blobs (if requested)
            await this.deleteBlobs(blobsToDelete, updateProgress, cancellationToken, properties);

            // Upload files as blobs
            await this.uploadFiles(sourceFolderPath, filePathsWithAzureSeparator, destBlobFolder, properties, updateProgress, cancellationToken);

            let webEndpoint = this.getPrimaryWebEndpoint();
            if (!webEndpoint) {
                throw new Error(`Could not obtain the primary web endpoint for ${this.root.storageAccount.name}`);
            }

            ext.outputChannel.appendLine(`Deployment to static website complete. Primary web endpoint is ${webEndpoint}`);

            return webEndpoint;
        } catch (error) {
            if (parseError(error).isUserCancelledError) {
                ext.outputChannel.appendLine("Deployment canceled.");
            }
            throw error;
        }
    }

    public getPrimaryWebEndpoint(): string | undefined {
        // Right now only one web endpoint is supported per storage account
        // tslint:disable-next-line:strict-boolean-expressions
        return this.root.storageAccount.primaryEndpoints && this.root.storageAccount.primaryEndpoints.web;
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
    private async uploadFiles(
        sourceFolderPath: string,
        filePathsWithAzureSeparator: string[],
        destBlobFolder: string,
        properties: TelemetryProperties & { fileLengths: number[] },
        incrementProgress: () => void,
        cancellationToken: vscode.CancellationToken
    ): Promise<void> {
        for (let filePath of filePathsWithAzureSeparator) {
            this.throwIfCanceled(cancellationToken, properties, "uploadFiles");

            try {
                let stat = await fse.stat(filePath);
                properties.fileLengths.push(stat.size);
            } catch (error) {
                // Ignore
            }

            let relativeFile = path.relative(sourceFolderPath, filePath);
            let blobPath = path.join(destBlobFolder, relativeFile);
            ext.outputChannel.appendLine(`Uploading ${filePath}...`);
            try {
                await this.uploadFileToBlockBlob(filePath, blobPath, true /* suppressLogs */);
            } catch (error) {
                throw new Error(`Error uploading "${filePath}": ${parseError(error).message} `);
            }
            incrementProgress();
        }
    }

    private async deleteBlobs(
        blobsToDelete: azureStorageBlob.BlobItem[],
        incrementProgress: () => void,
        cancellationToken: vscode.CancellationToken,
        properties: TelemetryProperties,
    ): Promise<void> {
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.root, this.container.name);
        for (let blob of blobsToDelete) {
            try {
                ext.outputChannel.appendLine(`Deleting blob "${blob.name}"...`);
                let response: azureStorageBlob.BlobDeleteResponse = await containerClient.deleteBlob(blob.name);
                if (cancellationToken.isCancellationRequested) {
                    throw new UserCancelledError();
                } else if (response.errorCode) {
                    throw new Error(response.errorCode);
                } else {
                    incrementProgress();
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

    private async uploadFileToBlockBlob(filePath: string, blobPath: string, suppressLogs: boolean = false): Promise<void> {
        const blobFriendlyPath: string = `${this.friendlyContainerName}/${blobPath}`;
        const blockBlobClient: azureStorageBlob.BlockBlobClient = createBlockBlobClient(this.root, this.container.name, blobPath);

        // tslint:disable-next-line: strict-boolean-expressions
        const totalBytes: number = (await fse.stat(filePath)).size || 1;

        if (!suppressLogs) {
            ext.outputChannel.appendLine(`Uploading ${filePath} as ${blobFriendlyPath}`);
        }

        const transferProgress: TransferProgress = new TransferProgress();
        const options: azureStorageBlob.BlockBlobParallelUploadOptions = {
            blobHTTPHeaders: {
                // tslint:disable-next-line: strict-boolean-expressions
                blobContentType: mime.getType(blobPath) || undefined
            },
            onProgress: suppressLogs ? undefined : (transferProgressEvent: TransferProgressEvent) => transferProgress.reportToOutputWindow(blobPath, transferProgressEvent.loadedBytes, totalBytes)
        };
        await blockBlobClient.uploadFile(filePath, options);

        if (!suppressLogs) {
            ext.outputChannel.appendLine(`Successfully uploaded ${blobFriendlyPath}.`);
        }
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

    private throwIfCanceled(cancellationToken: vscode.CancellationToken | undefined, properties: TelemetryProperties | undefined, cancelStep: string): void {
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            if (properties && cancelStep) {
                properties.cancelStep = cancelStep;
            }
            throw new UserCancelledError();
        }
    }

    private async checkCanUpload(localPath: string): Promise<void> {
        let size = (await fse.stat(localPath)).size;
        if (size > Limits.maxUploadDownloadSizeBytes) {
            await Limits.askOpenInStorageExplorer(
                `Please use Storage Explorer to upload files larger than ${Limits.maxUploadDownloadSizeMB}MB.`,
                this.root.storageAccount.id,
                this.root.subscriptionId,
                'Azure.BlobContainer',
                this.container.name);
        }
    }
}
