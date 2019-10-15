/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as fse from 'fs-extra';
import * as glob from 'glob';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProgressLocation, Uri } from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, AzureTreeItem, DialogResponses, GenericTreeItem, IActionContext, ICreateChildImplContext, parseError, TelemetryProperties, UserCancelledError } from 'vscode-azureextensionui';
import { awaitWithProgress } from '../../components/progress';
import { configurationSettingsKeys, extensionPrefix, getResourcesPath, staticWebsiteContainerName } from "../../constants";
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { StorageAccountTreeItem } from "../storageAccounts/storageAccountNode";
import { BlobContainerGroupTreeItem } from "./blobContainerGroupNode";
import { BlobDirectoryTreeItem } from "./BlobDirectoryTreeItem";
import { BlobFileHandler } from './blobFileHandler';
import { BlobTreeItem } from './blobNode';

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
    private _continuationTokenBlob: azureStorage.common.ContinuationToken | undefined;
    private _continuationTokenDirectory: azureStorage.common.ContinuationToken | undefined;
    private _websiteHostingEnabled: boolean;
    private _openInFileExplorerString: string = 'Open in File Explorer';

    private constructor(
        parent: BlobContainerGroupTreeItem,
        public readonly container: azureStorage.BlobService.ContainerResult) {
        super(parent);
    }

    public static async createBlobContainerTreeItem(parent: BlobContainerGroupTreeItem, container: azureStorage.BlobService.ContainerResult): Promise<BlobContainerTreeItem> {
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
        return !!this._continuationTokenBlob || !!this._continuationTokenDirectory;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        const result: AzExtTreeItem[] = [];
        if (clearCache) {
            this._continuationTokenBlob = undefined;
            this._continuationTokenDirectory = undefined;
            if (vscode.workspace.getConfiguration(extensionPrefix).get<boolean>(configurationSettingsKeys.enableViewInFileExplorer)) {
                const ti = new GenericTreeItem(this, {
                    label: this._openInFileExplorerString,
                    commandId: 'azureStorage.openBlobContainerInFileExplorer',
                    contextValue: 'openBlobContainerInFileExplorer'
                });

                ti.commandArgs = [this];
                result.push(ti);
            }
        }

        // currentToken argument typed incorrectly in SDK
        let blobs = await this.listBlobs(<azureStorage.common.ContinuationToken>this._continuationTokenBlob);
        let directories = await this.listDirectories(<azureStorage.common.ContinuationToken>this._continuationTokenDirectory);
        this._continuationTokenBlob = blobs.continuationToken;
        this._continuationTokenDirectory = directories.continuationToken;

        let blobChildren = blobs.entries.map((blob: azureStorage.BlobService.BlobResult) => new BlobTreeItem(this, "", blob, this.container));
        let directoryChildren = directories.entries.map((directory: azureStorage.BlobService.BlobDirectoryResult) => new BlobDirectoryTreeItem(this, "", { name: directory.name.substring(0, directory.name.length - 1) }, this.container));
        return result.concat(blobChildren).concat(directoryChildren);
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

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listBlobs(currentToken: azureStorage.common.ContinuationToken, maxResults: number = 50): Promise<azureStorage.BlobService.ListBlobsResult> {
        return new Promise<azureStorage.BlobService.ListBlobsResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobsSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: ""`);
            let blobService = this.root.createBlobService();
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobsSegmentedWithPrefix(this.container.name, "", currentToken, { delimiter: '/', maxResults: maxResults }, (error?: Error, result?: azureStorage.BlobService.ListBlobsResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listDirectories(currentToken: azureStorage.common.ContinuationToken, maxResults: number = 50): Promise<azureStorage.BlobService.ListBlobDirectoriesResult> {
        return new Promise<azureStorage.BlobService.ListBlobDirectoriesResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobDirectoriesSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: ""`);
            let blobService = this.root.createBlobService();
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobDirectoriesSegmentedWithPrefix(this.container.name, "", currentToken, { delimiter: '/', maxResults: maxResults }, (error?: Error, result?: azureStorage.BlobService.ListBlobDirectoriesResult) => {
                if (!!error) {
                    reject(error);
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

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete blob container '${this.label}' and all its contents?`;
        const result = await vscode.window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const blobService = this.root.createBlobService();
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

    public async createChildImpl(context: ICreateChildImplContext & Partial<IExistingBlobContext> & IBlobContainerCreateChildContext): Promise<BlobTreeItem | BlobDirectoryTreeItem> {
        if (context.blobPath && context.filePath) {
            context.showCreatingTreeItem(context.blobPath);
            await this.uploadFileToBlockBlob(context.filePath, context.blobPath);
            const actualBlob = await this.getBlob(context.blobPath);
            return new BlobTreeItem(this, "", actualBlob, this.container);
        } else if (context.childName && context.childType === BlobDirectoryTreeItem.contextValue) {
            return new BlobDirectoryTreeItem(this, "", { name: context.childName }, this.container);
        } else {
            return this.createChildAsNewBlockBlob(context);
        }
    }

    public async copyUrl(): Promise<void> {
        let blobService = this.root.createBlobService();
        let url = blobService.getUrl(this.container.name);
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
            let blobsToDelete: azureStorage.BlobService.BlobResult[] = [];
            let blobService = this.root.createBlobService();
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
            await this.deleteBlobs(blobService, blobsToDelete, updateProgress, cancellationToken, properties);

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

    private async uploadFileToBlockBlob(filePath: string, blobPath: string, suppressLogs: boolean = false): Promise<void> {
        let blobFriendlyPath = `${this.friendlyContainerName}/${blobPath}`;
        if (!suppressLogs) {
            ext.outputChannel.appendLine(`Uploading ${filePath} as ${blobFriendlyPath}`);
        }

        const blobService = this.root.createBlobService();
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
    private async createChildAsNewBlockBlob(context: ICreateChildImplContext & IBlobContainerCreateChildContext): Promise<BlobTreeItem> {
        let blobName: string | undefined = context.childName;
        if (!blobName) {
            blobName = await vscode.window.showInputBox({
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
        }

        if (blobName) {
            let blobNameString: string = <string>blobName;
            return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
                context.showCreatingTreeItem(blobNameString);
                progress.report({ message: `Azure Storage: Creating block blob '${blobNameString}'` });
                const blob = await this.createTextBlockBlob(blobNameString);
                const actualBlob = await this.getBlob(blob.name);
                return new BlobTreeItem(this, "", actualBlob, this.container);
            });
        }

        throw new UserCancelledError();
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private getBlob(name: string): Promise<azureStorage.BlobService.BlobResult> {
        const blobService = this.root.createBlobService();
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
            let blobService = this.root.createBlobService();
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

    private async doesBlobExist(blobPath: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const blobService = this.root.createBlobService();
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

export interface IBlobContainerCreateChildContext extends IActionContext {
    childType: string;
    childName: string;
}
