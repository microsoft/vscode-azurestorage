/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, callWithTelemetryAndErrorHandling, IActionContext, ICreateChildImplContext, parseError } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem, IBlobContainerCreateChildContext, IExistingBlobContext } from "./blobContainerNode";
import { BlobTreeItem, ISuppressMessageContext } from "./blobNode";
// tslint:disable-next-line: ordered-imports tslint:disable-next-line: no-require-imports
import mime = require("mime");

export class BlobDirectoryTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationTokenBlob: azureStorage.common.ContinuationToken | undefined;
    private _continuationTokenDirectory: azureStorage.common.ContinuationToken | undefined;

    public static contextValue: string = 'azureBlobDirectory';
    public contextValue: string = 'azureBlobDirectory';

    public fullPath: string = path.posix.join(this.parentPath, this.directory.name);
    public dirPath: string = `${this.fullPath}/`;
    public label: string = this.directory.name;

    constructor(
        parent: BlobContainerTreeItem | BlobDirectoryTreeItem,
        public readonly parentPath: string,
        public readonly directory: azureStorage.BlobService.BlobDirectoryResult, // directory.name should not include parent path
        public container: azureStorage.BlobService.ContainerResult) {
        super(parent);
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationTokenBlob || !!this._continuationTokenDirectory;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationTokenBlob = undefined;
            this._continuationTokenDirectory = undefined;
        }

        let blobRes = await this.listBlobs(<azureStorage.common.ContinuationToken>this._continuationTokenBlob);
        let dirRes = await this.listDirectories(<azureStorage.common.ContinuationToken>this._continuationTokenDirectory);

        this._continuationTokenBlob = blobRes.continuationToken;
        this._continuationTokenDirectory = dirRes.continuationToken;

        let children: AzExtTreeItem[] = [];
        for (const blob of blobRes.entries) {
            blob.name = path.basename(blob.name);
            children.push(new BlobTreeItem(this, this.dirPath, blob, this.container));
        }
        for (const directory of dirRes.entries) {
            directory.name = path.basename(directory.name.substring(0, directory.name.length - 1));
            children.push(new BlobDirectoryTreeItem(this, this.dirPath, directory, this.container));
        }

        return children;
    }

    public async createChildImpl(context: ICreateChildImplContext & Partial<IExistingBlobContext> & IBlobContainerCreateChildContext): Promise<BlobTreeItem | BlobDirectoryTreeItem> {
        if (context.childType === BlobTreeItem.contextValue) {
            return await this.createChildAsNewBlockBlob(context);
        } else {
            return new BlobDirectoryTreeItem(this, this.dirPath, { name: context.childName }, this.container);
        }
    }

    // Currently only supports creating block blobs
    private async createChildAsNewBlockBlob(context: ICreateChildImplContext & IBlobContainerCreateChildContext): Promise<BlobTreeItem> {
        let blobName: string = context.childName;
        if (await this.doesBlobExist(blobName)) {
            throw new Error("A blob with this path and name already exists");
        }

        return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(blobName);
            progress.report({ message: `Azure Storage: Creating block blob '${blobName}'` });
            const blob = await this.createTextBlockBlob(blobName);
            const actualBlob = await this.getBlob(blob.name);
            actualBlob.name = path.basename(blobName);
            return new BlobTreeItem(this, this.dirPath, actualBlob, this.container);
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private createTextBlockBlob(name: string): Promise<azureStorage.BlobService.BlobResult> {
        return new Promise((resolve, reject) => {
            let blobService = this.root.createBlobService();

            let contentType: string | null = mime.getType(name);
            let temp: string | undefined = contentType === null ? undefined : contentType;

            blobService.createBlockBlobFromText(this.container.name, name, '', { contentSettings: { contentType: temp } }, (err?: Error, result?: azureStorage.BlobService.BlobResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
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

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
            progress.report({ message: `Deleting directory ${this.directory.name}` });
            let errors: boolean = await this.deleteFolder(context);

            if (errors) {
                // tslint:disable-next-line: no-multiline-string
                ext.outputChannel.appendLine(`Please refresh the viewlet to see the changes made.`);

                const viewOutput: vscode.MessageItem = { title: 'View Errors' };
                const errorMessage: string = `Errors occured when deleting "${this.directory.name}".`;
                vscode.window.showWarningMessage(errorMessage, viewOutput).then(async (result: vscode.MessageItem | undefined) => {
                    if (result === viewOutput) {
                        ext.outputChannel.show();
                    }
                });

                throw new Error(`Errors occured when deleting "${this.directory.name}".`);
            }
        });
    }

    private async deleteFolder(context: IActionContext): Promise<boolean> {
        let dirPaths: BlobDirectoryTreeItem[] = [];
        // tslint:disable-next-line: no-var-self
        let dirPath: BlobDirectoryTreeItem | undefined = this;

        let errors: boolean = false;

        // tslint:disable-next-line: strict-boolean-expressions
        while (dirPath) {
            let children = await dirPath.getCachedChildren(context);
            for (const child of children) {
                if (child instanceof BlobTreeItem) {
                    try {
                        await child.deleteTreeItemImpl(<ISuppressMessageContext>{ ...context, suppressMessage: true });
                    } catch (error) {
                        ext.outputChannel.appendLine(`Cannot delete ${child.fullPath}. ${parseError(error).message}`);
                        errors = true;
                    }
                } else if (child instanceof BlobDirectoryTreeItem) {
                    dirPaths.push(child);
                }
            }

            dirPath = dirPaths.pop();
        }

        return errors;
    }

    public async refreshImpl(): Promise<void> {
        return await callWithTelemetryAndErrorHandling('', async (context) => {
            let children = await this.getCachedChildren(context);

            for (const child of children) {
                if (child instanceof BlobDirectoryTreeItem) {
                    await child.refreshImpl();
                }
            }

            this._continuationTokenBlob = undefined;
            this._continuationTokenDirectory = undefined;
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listDirectories(currentToken: azureStorage.common.ContinuationToken, maxResults: number = 50): Promise<azureStorage.BlobService.ListBlobDirectoriesResult> {
        return new Promise<azureStorage.BlobService.ListBlobDirectoriesResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobDirectoriesSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: "${this.directory.name}"`);
            let blobService = this.root.createBlobService();
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobDirectoriesSegmentedWithPrefix(this.container.name, this.dirPath, currentToken, { delimiter: '/', maxResults: maxResults }, (error?: Error, result?: azureStorage.BlobService.ListBlobDirectoriesResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listBlobs(currentToken: azureStorage.common.ContinuationToken, maxResults: number = 50): Promise<azureStorage.BlobService.ListBlobsResult> {
        return new Promise<azureStorage.BlobService.ListBlobsResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobsSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: "${this.directory.name}"`);
            let blobService = this.root.createBlobService();
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobsSegmentedWithPrefix(this.container.name, this.dirPath, currentToken, { delimiter: '/', maxResults: maxResults }, (error?: Error, result?: azureStorage.BlobService.ListBlobsResult) => {
                if (!!error) {
                    reject(error);

                } else {
                    resolve(result);
                }
            });
        });
    }
}
