/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DialogOptions } from '../../azureServiceExplorer/messageItems/dialogOptions';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { BlobNode } from './blobNode';
import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { Uri } from 'vscode';
import { azureStorageOutputChannel } from '../azureStorageOutputChannel';
import { awaitWithProgress } from '../../components/progress';
import { BlobFileHandler } from './blobFileHandler';

const channel = azureStorageOutputChannel;
let lastUploadFolder: Uri;

export enum ChildType {
    newBlockBlob,
    uploadedBlob
}

export class BlobContainerNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly container: azureStorage.BlobService.ContainerResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public label: string = this.container.name;
    public contextValue: string = 'azureBlobContainer';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
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

    listBlobs(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.BlobService.ListBlobsResult> {
        return new Promise((resolve, reject) => {
            let blobService = this.createBlobService();
            blobService.listBlobsSegmented(this.container.name, currentToken, { maxResults: 50 }, (err: Error, result: azureStorage.BlobService.ListBlobsResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private createBlobService(): azureStorage.BlobService {
        return azureStorage.createBlobService(this.storageAccount.name, this.key.value);
    }

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete blob container '${this.label}' and all its contents?`;
        const result = await vscode.window.showWarningMessage(message, DialogOptions.yes, DialogOptions.cancel);
        if (result === DialogOptions.yes) {
            const blobService = this.createBlobService();
            await new Promise((resolve, reject) => {
                blobService.deleteContainer(this.container.name, err => {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }

    public async createChild(
        node: IAzureNode<BlobContainerNode>,
        showCreatingNode: (label: string) => void,
        userOptions: { childType: ChildType }
    ): Promise<IAzureTreeItem> {
        switch (userOptions.childType) {
            case ChildType.uploadedBlob:
                return this.createChildFromUpload(node, showCreatingNode);
            case ChildType.newBlockBlob:
                return this.createChildAsNewBlockBlob(showCreatingNode);
            default:
                throw new Error("Unexpected child type");
        }
    }

    // Currently only supports creating block blobs
    public async createChildAsNewBlockBlob(showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const blobName = await vscode.window.showInputBox({
            placeHolder: 'Enter a name for the new block blob',
            validateInput: BlobContainerNode.validateBlobName
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
            return 'Blob name cannot end with a forward or backward slash or a period.';
        }

        return undefined;
    }

    private async createChildFromUpload(node: IAzureNode<BlobContainerNode>, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
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
                    ]
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
                value: path.basename(filePath)
            });
            if (blobPath) {
                if (await this.doesBlobExist(blobPath)) {
                    const result = await vscode.window.showWarningMessage(
                        `A blob with the name ${blobPath} already exists. Do you want to overwrite it?`,
                        DialogOptions.yes, DialogOptions.cancel);
                    if (result !== DialogOptions.yes) {
                        throw new UserCancelledError();
                    }
                } else {
                    showCreatingNode(blobPath);
                }

                await this.uploadBlockBlob(filePath, blobPath);

                const actualBlob = await this.getBlob(blobPath);
                return new BlobNode(actualBlob, this.container, this.storageAccount, this.key);
            }
        }

        throw new UserCancelledError();
    }

    private async uploadBlockBlob(filePath: string, blob: string): Promise<void> {
        let blobFullDisplayPath = `${this.storageAccount.name}/${this.container.name}/${blob}`;
        channel.show();
        channel.appendLine(`Uploading ${filePath} as ${blobFullDisplayPath}`);
        const blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
        let speedSummary;
        const promise = new Promise((resolve, reject) => {
            speedSummary = blobService.createBlockBlobFromLocalFile(this.container.name, blob, filePath, function (err: any): void {
                err ? reject(err) : resolve();
            });
        });
        await awaitWithProgress(`Uploading ${blob}`, channel, promise, () => {
            const completed = <string>speedSummary.getCompleteSize(true);
            const total = <string>speedSummary.getTotalSize(true);
            const percent = speedSummary.getCompletePercent(0);
            const msg = `${blob}: ${completed}/${total} (${percent}%)`;
            return msg;
        });
        channel.appendLine(`Successfully uploaded ${blobFullDisplayPath}.`);
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
}
