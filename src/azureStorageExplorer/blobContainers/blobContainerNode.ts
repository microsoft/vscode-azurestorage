/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fse from 'fs-extra';
import * as glob from 'glob';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { BlobNode } from './blobNode';
import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode, UserCancelledError, IAzureParentNode, DialogResponses, IActionContext, parseError, TelemetryProperties } from 'vscode-azureextensionui';
import { Uri, ProgressLocation } from 'vscode';
import { azureStorageOutputChannel } from '../azureStorageOutputChannel';
import { awaitWithProgress } from '../../components/progress';
import { BlobFileHandler } from './blobFileHandler';
import * as copypaste from 'copy-paste';
import { ICopyUrl } from '../../ICopyUrl';

const channel = azureStorageOutputChannel;
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

export class BlobContainerNode implements IAzureParentTreeItem, ICopyUrl {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly container: azureStorage.BlobService.ContainerResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public label: string = this.container.name;
    public static contextValue: string = 'azureBlobContainer';
    public contextValue: string = BlobContainerNode.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };

    public hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    public async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let blobs = await this.listBlobs(this._continuationToken);
        let { entries, continuationToken } = blobs;
        this._continuationToken = continuationToken;
        return entries.map((blob: azureStorage.BlobService.BlobResult) => {
            return new BlobNode(blob, this.container, this.storageAccount, this.key);
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private listBlobs(currentToken: azureStorage.common.ContinuationToken, maxResults: number = 50): Promise<azureStorage.BlobService.ListBlobsResult> {
        return new Promise((resolve, reject) => {
            let blobService = this.createBlobService();
            blobService.listBlobsSegmented(this.container.name, currentToken, { maxResults }, (err: Error, result: azureStorage.BlobService.ListBlobsResult) => {
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
        let currentToken: any;
        let blobs: azureStorage.BlobService.BlobResult[] = [];

        // tslint:disable-next-line:no-constant-condition
        while (true) {
            this.throwIfCanceled(cancellationToken, properties, "listAllBlobs");
            let result = await this.listBlobs(currentToken, 5000);
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

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete blob container '${this.label}' and all its contents?`;
        const result = await vscode.window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const blobService = this.createBlobService();
            await new Promise((resolve, reject) => {
                blobService.deleteContainer(this.container.name, err => {
                    // tslint:disable-next-line:no-void-expression // Grandfathered in
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }

    public async createChild(_node: IAzureNode<BlobContainerNode>, showCreatingNode: (label: string) => void, userOptions: ICreateChildOptions): Promise<IAzureTreeItem> {
        switch (userOptions.childType) {
            case ChildType.uploadedBlob:
                return this.createChildAsUpload(userOptions, showCreatingNode);
            case ChildType.newBlockBlob:
                return this.createChildAsNewBlockBlob(showCreatingNode);
            default:
                throw new Error("Unexpected child type");
        }
    }

    public async copyUrl(_node: IAzureParentNode<BlobContainerNode>): Promise<void> {
        let blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
        let url = blobService.getUrl(this.container.name);
        copypaste.copy(url);
        azureStorageOutputChannel.show();
        azureStorageOutputChannel.appendLine(`Container URL copied to clipboard: ${url}`);
    }

    // This is the public entrypoint for azureStorage.uploadBlockBlob
    public async uploadBlockBlob(node: IAzureParentNode<BlobContainerNode>, output: vscode.OutputChannel): Promise<void> {
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
        if (uris && uris[0]) {
            let uri = uris[0];
            lastUploadFolder = uri;
            let filePath = uri.fsPath;

            let handler = new BlobFileHandler();
            await handler.checkCanUpload(node, filePath);

            let blobPath = await vscode.window.showInputBox({
                prompt: 'Enter a name for the uploaded block blob (may include a path)',
                value: path.basename(filePath),
                validateInput: BlobContainerNode.validateBlobName
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

                    let blobId = `${node.id}/${blobPath}`;
                    try {
                        let blobNode = await node.treeDataProvider.findNode(blobId);
                        if (blobNode) {
                            // A node for this blob already exists, no need to do anything with the tree, just upload
                            await this.uploadFileToBlockBlob(filePath, blobPath, output);
                            return;
                        }
                    } catch (err) {
                        // https://github.com/Microsoft/vscode-azuretools/issues/85
                    }
                }

                await node.createChild(<ICreateChildOptions>{ childType: ChildType.uploadedBlob, blobPath, filePath });
            }
        }

        throw new UserCancelledError();
    }

    public async deployStaticWebsite(node: IAzureParentNode<BlobContainerNode>, _actionContext: IActionContext, sourceFolderPath: string): Promise<void> {
        let destBlobFolder = "";

        await vscode.window.withProgress(
            {
                cancellable: true,
                location: ProgressLocation.Notification,
                title: `Deploying to ${this.friendlyContainerName} from ${sourceFolderPath}`,

            },
            async (progress, cancellationToken) => await this.deployStaticWebsiteCore(_actionContext, sourceFolderPath, destBlobFolder, azureStorageOutputChannel, progress, cancellationToken),
        );

        let goToPortal: vscode.MessageItem = { title: "Retrieve primary endpoint from portal" };
        let result = await vscode.window.showInformationMessage(
            "Deployment complete. View the website using the primary web endpoint URL, which is available in the configure tab on the Azure portal.",
            goToPortal
        );
        if (result === goToPortal) {
            vscode.commands.executeCommand("azureStorage.configureStaticWebsite", node);
        }
    }

    private get friendlyContainerName(): string {
        return `${this.storageAccount.name}/${this.container.name}`;
    }

    private async deployStaticWebsiteCore(
        _actionContext: IActionContext,
        sourceFolderPath: string,
        destBlobFolder: string,
        output: vscode.OutputChannel,
        progress: vscode.Progress<{ message?: string, increment?: number }>,
        cancellationToken: vscode.CancellationToken
    ): Promise<void> {
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
                let message = `Are you sure you want to deploy to ${this.friendlyContainerName}?  This will delete all ${blobsToDelete.length} files currently in the ${this.friendlyContainerName} blob container.`;
                let deleteAndDeploy: vscode.MessageItem = { title: 'Delete and Deploy' };
                const result = await vscode.window.showWarningMessage(message, { modal: true }, deleteAndDeploy, DialogResponses.cancel);
                if (result !== deleteAndDeploy) {
                    properties.cancelStep = 'AreYouSureYouWantToDeleteExistingBlobs';
                    throw new UserCancelledError();
                }
            }

            // azureStorageOutputChannel.show();
            output.appendLine(`Deploying to static website ${this.storageAccount.name}/${this.container.name}`);

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
            await this.deleteBlobs(blobService, blobsToDelete, updateProgress, cancellationToken, properties, output);

            // Upload files as blobs
            await this.uploadFiles(sourceFolderPath, filePathsWithAzureSeparator, destBlobFolder, properties, updateProgress, output, cancellationToken);

            output.appendLine("Deployment to static website complete.");
        } catch (error) {
            if (parseError(error).isUserCancelledError) {
                output.appendLine("Deployment canceled.");
                throw error;
            }
        }
    }

    private async uploadFiles(
        sourceFolderPath: string,
        filePathsWithAzureSeparator: string[],
        destBlobFolder: string,
        properties: TelemetryProperties & { fileLengths: number[] },
        incrementProgress: () => void,
        output: vscode.OutputChannel,
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
            output.appendLine(`Uploading ${filePath}...`);
            try {
                await this.uploadFileToBlockBlob(filePath, blobPath, undefined);
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
        output: vscode.OutputChannel
    ): Promise<void> {
        for (let blob of blobsToDelete) {
            try {
                await new Promise((resolve, reject) => {
                    output.appendLine(`Deleting blob "${blob.name}"...`);
                    blobService.deleteBlob(this.container.name, blob.name, (err) => {
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

    private async createChildAsUpload(options: ICreateChildOptions, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        showCreatingNode(options.blobPath);
        await this.uploadFileToBlockBlob(options.filePath, options.blobPath, azureStorageOutputChannel);
        const actualBlob = await this.getBlob(options.blobPath);
        return new BlobNode(actualBlob, this.container, this.storageAccount, this.key);
    }

    private async uploadFileToBlockBlob(filePath: string, blobPath: string, output: vscode.OutputChannel): Promise<void> {
        let blobFriendlyPath = `${this.friendlyContainerName}${blobPath}`;
        if (output) {
            output.appendLine(`Uploading ${filePath} as ${blobFriendlyPath}`);
        }
        const blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
        let speedSummary;
        const uploadPromise = new Promise((resolve, reject) => {
            // tslint:disable-next-line:no-function-expression // Grandfathered in
            speedSummary = blobService.createBlockBlobFromLocalFile(this.container.name, blobPath, filePath, function (err: {}): void {
                // tslint:disable-next-line:no-void-expression // Grandfathered in
                err ? reject(err) : resolve();
            });
        });

        if (output) {
            await awaitWithProgress(
                `Uploading ${blobPath}`,
                channel,
                uploadPromise, () => {
                    const completed = <string>speedSummary.getCompleteSize(true);
                    const total = <string>speedSummary.getTotalSize(true);
                    const percent = speedSummary.getCompletePercent(0);
                    const msg = `${blobPath}: ${completed}/${total} bytes (${percent}%)`;
                    return msg;
                });
        } else {
            await uploadPromise;
        }

        if (output) {
            output.appendLine(`Successfully uploaded ${blobFriendlyPath}.`);
        }
    }

    // Currently only supports creating block blobs
    private async createChildAsNewBlockBlob(showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const blobName = await vscode.window.showInputBox({
            placeHolder: 'Enter a name for the new block blob',
            validateInput: async (name: string) => {
                let nameError = BlobContainerNode.validateBlobName(name);
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
                showCreatingNode(blobName);
                progress.report({ message: `Azure Storage: Creating block blob '${blobName}'` });
                const blob = await this.createTextBlockBlob(blobName);
                const actualBlob = await this.getBlob(blob.name);
                return new BlobNode(actualBlob, this.container, this.storageAccount, this.key);
            });
        }

        throw new UserCancelledError();
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private getBlob(name: string): Promise<azureStorage.BlobService.BlobResult> {
        const blobService = this.createBlobService();
        return new Promise((resolve, reject) => {
            blobService.getBlobProperties(this.container.name, name, (err: Error, result: azureStorage.BlobService.BlobResult) => {
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
            blobService.createBlockBlobFromText(this.container.name, name, '', options, (err: Error, result: azureStorage.BlobService.BlobResult) => {
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
            blobService.doesBlobExist(this.container.name, blobPath, (err: Error, result: azureStorage.BlobService.BlobResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result.exists === true);
                }
            });
        });
    }

    private throwIfCanceled(cancellationToken: vscode.CancellationToken | undefined, properties: TelemetryProperties, cancelStep: string): void {
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            if (properties && cancelStep) {
                properties.cancelStep = cancelStep;
            }
            throw new UserCancelledError();
        }
    }

}
