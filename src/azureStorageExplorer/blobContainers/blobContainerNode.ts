/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as copypaste from 'copy-paste';
import * as fse from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import { ProgressLocation, Uri } from 'vscode';
import * as vscode from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, parseError, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import { awaitWithProgress } from '../../components/progress';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from "../../components/storageWrappers";
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { StorageAccountTreeItem } from "../storageAccounts/storageAccountNode";
import { BlobFileHandler } from './blobFileHandler';
import { BlobTreeItem } from './blobNode';

let lastUploadFolder: Uri;

export enum ChildType {
    newBlockBlob,
    uploadedBlob
}

interface ICreateChildOptions {
    childType: ChildType;
    filePath: string;
    blobPath: string;
}

export class BlobContainerTreeItem extends AzureParentTreeItem implements ICopyUrl {
    private _continuationToken: azureStorage.common.ContinuationToken | undefined;

    constructor(
        parent: AzureParentTreeItem,
        public readonly container: azureStorage.BlobService.ContainerResult,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly key: StorageAccountKeyWrapper) {
        super(parent);
    }

    public label: string = this.container.name;
    public static contextValue: string = 'azureBlobContainer';
    public contextValue: string = BlobContainerTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // currentToken argument typed incorrectly in SDK
        let blobs = await this.listBlobs(<azureStorage.common.ContinuationToken>this._continuationToken);
        let { entries, continuationToken } = blobs;
        this._continuationToken = continuationToken;
        return entries.map((blob: azureStorage.BlobService.BlobResult) => {
            return new BlobTreeItem(this, blob, this.container, this.storageAccount, this.key);
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private listBlobs(currentToken: azureStorage.common.ContinuationToken, maxResults: number = 50): Promise<azureStorage.BlobService.ListBlobsResult> {
        return new Promise((resolve, reject) => {
            let blobService = this.createBlobService();
            blobService.listBlobsSegmented(this.container.name, currentToken, { maxResults }, (err?: Error, result?: azureStorage.BlobService.ListBlobsResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private async listAllBlobs(cancellationToken?: vscode.CancellationToken, properties?: TelemetryProperties): Promise<azureStorage.BlobService.BlobResult[]> {
        // tslint:disable-next-line:no-any
        let currentToken: azureStorage.common.ContinuationToken | undefined;
        let blobs: azureStorage.BlobService.BlobResult[] = [];

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            this.throwIfCanceled(cancellationToken, properties, "listAllBlobs");
            // currentToken argument typed incorrectly in SDK
            let result = await this.listBlobs(<azureStorage.common.ContinuationToken>currentToken, 5000);
            blobs.push(...result.entries);
            currentToken = result.continuationToken;
            if (!currentToken) {
                break;
            }
        }

        return blobs;
    }

    private createBlobService(): azureStorage.BlobService {
        return azureStorage.createBlobService(this.storageAccount.name, this.key.value);
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete blob container '${this.label}' and all its contents?`;
        const result = await vscode.window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const blobService = this.createBlobService();
            await new Promise((resolve, reject) => {
                // tslint:disable-next-line:no-any
                blobService.deleteContainer(this.container.name, (err?: any) => {
                    // tslint:disable-next-line:no-void-expression // Grandfathered in
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, userOptions: ICreateChildOptions): Promise<AzureTreeItem> {
        switch (userOptions.childType) {
            case ChildType.uploadedBlob:
                return this.createChildAsUpload(userOptions, showCreatingTreeItem);
            case ChildType.newBlockBlob:
                return this.createChildAsNewBlockBlob(showCreatingTreeItem);
            default:
                throw new Error("Unexpected child type");
        }
    }

    public async copyUrl(): Promise<void> {
        let blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
        let url = blobService.getUrl(this.container.name);
        copypaste.copy(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Container URL copied to clipboard: ${url}`);
    }

    // This is the public entrypoint for azureStorage.uploadBlockBlob
    public async uploadBlockBlob(): Promise<void> {
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

            let handler = new BlobFileHandler();
            await handler.checkCanUpload(this, filePath);

            let blobPath = await vscode.window.showInputBox({
                prompt: 'Enter a name for the uploaded block blob (may include a path)',
                value: path.basename(filePath),
                validateInput: BlobContainerTreeItem.validateBlobName
            });
            if (blobPath) {
                if (await this.doesBlobExist(blobPath)) {
                    const result = await vscode.window.showWarningMessage(
                        `A blob with the name "${blobPath}" already exists. Do you want to overwrite it?`,
                        { modal: true },
                        DialogResponses.yes, DialogResponses.cancel);
                    if (result !== DialogResponses.yes) {
                        throw new UserCancelledError();
                    }

                    let blobId = `${this.fullId}/${blobPath}`;
                    try {
                        let blobTreeItem = await this.treeDataProvider.findTreeItem(blobId);
                        if (blobTreeItem) {
                            // A treeItem for this blob already exists, no need to do anything with the tree, just upload
                            await this.uploadFileToBlockBlob(filePath, blobPath);
                            return;
                        }
                    } catch (err) {
                        // https://github.com/Microsoft/vscode-azuretools/issues/85
                    }
                }

                await this.createChild(<ICreateChildOptions>{ childType: ChildType.uploadedBlob, blobPath, filePath });
            }
        }

        throw new UserCancelledError();
    }

    public async deployStaticWebsite(actionContext: IActionContext, sourceFolderPath: string): Promise<void> {
        let destBlobFolder = "";
        let webEndpoint = await vscode.window.withProgress(
            {
                cancellable: true,
                location: ProgressLocation.Notification,
                title: `Deploying to ${this.friendlyContainerName} from ${sourceFolderPath}`,

            },
            async (progress, cancellationToken) => await this.deployStaticWebsiteCore(actionContext, sourceFolderPath, destBlobFolder, progress, cancellationToken),
        );

        let browseWebsite: vscode.MessageItem = { title: "Browse to website" };
        let result = await vscode.window.showInformationMessage(
            `Deployment complete. The primary web endpoint is ${webEndpoint}`,
            browseWebsite
        );
        if (result === browseWebsite) {
            await vscode.commands.executeCommand('azureStorage.browseStaticWebsite', this);
        }
    }

    private get friendlyContainerName(): string {
        return `${this.storageAccount.name}/${this.container.name}`;
    }

    /**
     * deployStaticWebsiteCore
     *
     * @returns The primary web endpoint
     */
    private async deployStaticWebsiteCore(
        _actionContext: IActionContext,
        sourceFolderPath: string,
        destBlobFolder: string,
        progress: vscode.Progress<{ message?: string, increment?: number }>,
        cancellationToken: vscode.CancellationToken
    ): Promise<string> {
        let properties = <TelemetryProperties & {
            blobsToDelete: number;
            filesToUpload: number;
            fileLengths: number[];
        }>_actionContext.properties;

        try {
            properties.fileLengths = [];

            const isFolder = (file: string): boolean => file.endsWith("/");

            // Find existing blobs
            let blobsToDelete: azureStorage.BlobService.BlobResult[] = [];
            let blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
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
            ext.outputChannel.appendLine(`Deploying to static website ${this.storageAccount.name}/${this.container.name}`);

            // Find source files
            // Note: glob always returns paths with '/' separator, even on Windows, which also is the main
            // separator used by Azure.
            let filePathsWithAzureSeparator = await new Promise<string[]>(
                (resolve, reject) => {
                    glob(
                        path.join(sourceFolderPath, '**'),
                        {
                            mark: true // Add '/' to folders
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
            await this.deleteBlobs(blobService, blobsToDelete, updateProgress, cancellationToken, properties);

            // Upload files as blobs
            await this.uploadFiles(sourceFolderPath, filePathsWithAzureSeparator, destBlobFolder, properties, updateProgress, cancellationToken);

            let webEndpoint = this.getPrimaryWebEndpoint();
            if (!webEndpoint) {
                throw new Error(`Could not obtain the primary web endpoint for ${this.storageAccount.name}`);
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
        return this.storageAccount.primaryEndpoints && this.storageAccount.primaryEndpoints.web;
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
        blobService: azureStorage.BlobService,
        blobsToDelete: azureStorage.BlobService.BlobResult[],
        incrementProgress: () => void,
        cancellationToken: vscode.CancellationToken,
        properties: TelemetryProperties,
    ): Promise<void> {
        for (let blob of blobsToDelete) {
            try {
                await new Promise((resolve, reject) => {
                    ext.outputChannel.appendLine(`Deleting blob "${blob.name}"...`);
                    // tslint:disable-next-line:no-any
                    blobService.deleteBlob(this.container.name, blob.name, (err?: any) => {
                        if (err) {
                            reject(err);
                        } else {
                            if (cancellationToken.isCancellationRequested) {
                                reject(new UserCancelledError());
                            } else {
                                incrementProgress();
                                resolve();
                            }
                        }
                    });
                });
            } catch (error) {
                if (parseError(error).isUserCancelledError) {
                    properties.cancelStep = "deleteBlobs";
                    throw error;
                }

                throw new Error(`Error deleting blob "${blob.name}" : ${parseError(error).message}`);
            }
        }
    }

    private async createChildAsUpload(options: ICreateChildOptions, showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem> {
        showCreatingTreeItem(options.blobPath);
        await this.uploadFileToBlockBlob(options.filePath, options.blobPath);
        const actualBlob = await this.getBlob(options.blobPath);
        return new BlobTreeItem(this, actualBlob, this.container, this.storageAccount, this.key);
    }

    private async uploadFileToBlockBlob(filePath: string, blobPath: string, suppressLogs: boolean = false): Promise<void> {
        let blobFriendlyPath = `${this.friendlyContainerName}${blobPath}`;
        if (!suppressLogs) {
            ext.outputChannel.appendLine(`Uploading ${filePath} as ${blobFriendlyPath}`);
        }

        const blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
        let speedSummary: azureStorage.common.streams.speedsummary.SpeedSummary;
        const uploadPromise = new Promise((resolve, reject) => {
            // tslint:disable-next-line:no-function-expression // Grandfathered in
            speedSummary = blobService.createBlockBlobFromLocalFile(this.container.name, blobPath, filePath, function (err?: {}): void {
                // tslint:disable-next-line:no-void-expression // Grandfathered in
                err ? reject(err) : resolve();
            });
        });

        if (!suppressLogs) {
            await awaitWithProgress(
                `Uploading ${blobPath}`,
                uploadPromise,
                () => {
                    const completed = <string>speedSummary.getCompleteSize(true);
                    const total = <string>speedSummary.getTotalSize(true);
                    const percent = speedSummary.getCompletePercent(0);
                    const msg = `${blobPath}: ${completed}/${total} bytes (${percent}%)`;
                    return msg;
                });
        } else {
            await uploadPromise;
        }

        if (!suppressLogs) {
            ext.outputChannel.appendLine(`Successfully uploaded ${blobFriendlyPath}.`);
        }
    }

    // Currently only supports creating block blobs
    private async createChildAsNewBlockBlob(showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem> {
        const blobName = await vscode.window.showInputBox({
            placeHolder: 'Enter a name for the new block blob',
            validateInput: async (name: string) => {
                let nameError = BlobContainerTreeItem.validateBlobName(name);
                if (nameError) {
                    return nameError;
                } else if (await this.doesBlobExist(name)) {
                    return "A blob with this path and name already exists";
                }

                return undefined;
            }
        });

        if (blobName) {
            return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
                showCreatingTreeItem(blobName);
                progress.report({ message: `Azure Storage: Creating block blob '${blobName}'` });
                const blob = await this.createTextBlockBlob(blobName);
                const actualBlob = await this.getBlob(blob.name);
                return new BlobTreeItem(this, actualBlob, this.container, this.storageAccount, this.key);
            });
        }

        throw new UserCancelledError();
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private getBlob(name: string): Promise<azureStorage.BlobService.BlobResult> {
        const blobService = this.createBlobService();
        return new Promise((resolve, reject) => {
            blobService.getBlobProperties(this.container.name, name, (err?: Error, result?: azureStorage.BlobService.BlobResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private createTextBlockBlob(name: string): Promise<azureStorage.BlobService.BlobResult> {
        return new Promise((resolve, reject) => {
            let blobService = this.createBlobService();
            const options = <azureStorage.BlobService.CreateBlobRequestOptions>{
                contentSettings: {
                    contentType: 'text/plain'
                }
            };
            blobService.createBlockBlobFromText(this.container.name, name, '', options, (err?: Error, result?: azureStorage.BlobService.BlobResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private static validateBlobName(name: string): string | undefined | null {
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

    private async doesBlobExist(blobPath: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const blobService = this.createBlobService();
            blobService.doesBlobExist(this.container.name, blobPath, (err?: Error, result?: azureStorage.BlobService.BlobResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result && result.exists === true);
                }
            });
        });
    }

    private throwIfCanceled(cancellationToken: vscode.CancellationToken | undefined, properties: TelemetryProperties | undefined, cancelStep: string): void {
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            if (properties && cancelStep) {
                properties.cancelStep = cancelStep;
            }
            throw new UserCancelledError();
        }
    }

}
