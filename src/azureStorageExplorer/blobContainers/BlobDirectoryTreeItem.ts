/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, AzureParentTreeItem, IActionContext, ICreateChildImplContext, parseError } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem, IBlobContainerCreateChildContext, IExistingBlobContext } from "./blobContainerNode";
import { BlobTreeItem } from "./blobNode";
// tslint:disable-next-line: ordered-imports tslint:disable-next-line: no-require-imports
import mime = require("mime");

export class BlobDirectoryTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationTokenBlob: azureStorage.common.ContinuationToken | undefined;
    private _continuationTokenDir: azureStorage.common.ContinuationToken | undefined;

    public basename: string = path.basename(this.name);
    public label: string = this.basename;
    public static contextValue: string = 'azureBlobDirectory';
    public contextValue: string = 'azureBlobDirectory';

    constructor(
        parent: BlobContainerTreeItem | BlobDirectoryTreeItem,
        public name: string,
        public container: azureStorage.BlobService.ContainerResult) {
        super(parent);
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationTokenBlob = undefined;
            this._continuationTokenDir = undefined;
        }

        let blobService = this.root.createBlobService();
        let blobRes = await new Promise<azureStorage.BlobService.ListBlobsResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobsSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: "${this.name}"`);
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobsSegmentedWithPrefix(this.container.name, this.name, <azureStorage.common.ContinuationToken>undefined!, { delimiter: '/' }, (error?: Error, result?: azureStorage.BlobService.ListBlobsResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
        let dirRes = await new Promise<azureStorage.BlobService.ListBlobDirectoriesResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobDirectoriesSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: "${this.name}"`);
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobDirectoriesSegmentedWithPrefix(this.container.name, this.name, <azureStorage.common.ContinuationToken>undefined!, (error?: Error, result?: azureStorage.BlobService.ListBlobDirectoriesResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        this._continuationTokenBlob = blobRes.continuationToken;
        this._continuationTokenDir = dirRes.continuationToken;

        let children: AzExtTreeItem[] = [];
        for (const blob of blobRes.entries) {
            children.push(new BlobTreeItem(this, blob, this.container));
        }
        for (const dir of dirRes.entries) {
            children.push(new BlobDirectoryTreeItem(this, dir.name, this.container));
        }

        return children;
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationTokenBlob || !!this._continuationTokenDir;
    }

    public async createChildImpl(context: ICreateChildImplContext & Partial<IExistingBlobContext> & IBlobContainerCreateChildContext): Promise<BlobTreeItem | BlobDirectoryTreeItem> {
        if (context.childType === BlobTreeItem.contextValue) {
            return await this.createChildAsNewBlockBlob(context);
        } else {
            return new BlobDirectoryTreeItem(this, path.basename(context.childName), this.container);
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
            return new BlobTreeItem(this, actualBlob, this.container);
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
            progress.report({ message: `Deleting directory ${this.name}` });
            let errors: boolean = await this.deleteFolder(context);

            if (errors) {
                // tslint:disable-next-line: no-multiline-string
                ext.outputChannel.appendLine(`Please refresh the viewlet to see the changes made.`);

                const viewOutput: vscode.MessageItem = { title: 'View Errors' };
                const errorMessage: string = `Errors occured when deleting "${this.name}".`;
                vscode.window.showWarningMessage(errorMessage, viewOutput).then(async (result: vscode.MessageItem | undefined) => {
                    if (result === viewOutput) {
                        ext.outputChannel.show();
                    }
                });

            }
        });
    }

    private async deleteFolder(context: IActionContext): Promise<boolean> {
        let dirPaths: string[] = [];
        let dirPath: string | undefined = this.name;

        let errors: boolean = false;

        while (dirPath) {
            let children = await this.getCachedChildren(context);
            for (const child of children) {
                if (child instanceof BlobTreeItem) {
                    try {
                        await child.deleteTreeItemImpl();
                    } catch (error) {
                        ext.outputChannel.appendLine(`Cannot delete ${child.label}. ${parseError(error).message}`);
                        errors = true;
                    }
                } else if (child instanceof BlobDirectoryTreeItem) {
                    dirPaths.push(child.basename);
                }
            }

            dirPath = dirPaths.pop();
        }

        return errors;
    }
}
