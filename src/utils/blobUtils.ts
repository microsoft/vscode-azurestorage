/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as mime from "mime";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, IActionContext, ICreateChildImplContext } from 'vscode-azureextensionui';
import { maxPageSize } from '../constants';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { BlobDirectoryTreeItem } from '../tree/blob/BlobDirectoryTreeItem';
import { BlobTreeItem } from '../tree/blob/BlobTreeItem';
import { IStorageRoot } from "../tree/IStorageRoot";

export function createBlobContainerClient(root: IStorageRoot, containerName: string): azureStorageBlob.ContainerClient {
    const blobServiceClient: azureStorageBlob.BlobServiceClient = root.createBlobServiceClient();
    return blobServiceClient.getContainerClient(containerName);
}

export function createBlobClient(root: IStorageRoot, containerName: string, blobName: string): azureStorageBlob.BlobClient {
    const blobContainerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(root, containerName);
    return blobContainerClient.getBlobClient(blobName);
}

export function createBlockBlobClient(root: IStorageRoot, containerName: string, blobName: string): azureStorageBlob.BlockBlobClient {
    const blobContainerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(root, containerName);
    return blobContainerClient.getBlockBlobClient(blobName);
}

export async function loadMoreBlobChildren(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, continuationToken?: string): Promise<{ children: AzExtTreeItem[], continuationToken?: string }> {
    const prefix: string | undefined = parent instanceof BlobDirectoryTreeItem ? parent.dirPath : undefined;
    const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(parent.root, parent.container.name);
    let response: AsyncIterableIterator<azureStorageBlob.ContainerListBlobHierarchySegmentResponse> = containerClient.listBlobsByHierarchy(path.posix.sep, { prefix }).byPage({ continuationToken, maxPageSize: maxPageSize });

    // tslint:disable-next-line: no-unsafe-any
    let responseValue: azureStorageBlob.ListBlobsHierarchySegmentResponse = (await response.next()).value;
    continuationToken = responseValue.continuationToken;

    let children: AzExtTreeItem[] = [];
    for (const blob of responseValue.segment.blobItems) {
        // NOTE: `blob.name` as returned from Azure is actually the blob path in the container
        children.push(new BlobTreeItem(parent, blob.name, parent.container));
    }

    // tslint:disable-next-line: strict-boolean-expressions
    for (const directory of responseValue.segment.blobPrefixes || []) {
        // NOTE: `directory.name` as returned from Azure is actually the directory path in the container
        children.push(new BlobDirectoryTreeItem(parent, directory.name, parent.container));
    }

    return { children, continuationToken };
}

// Currently only supports creating block blobs
export async function createChildAsNewBlockBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, context: ICreateChildImplContext & IBlobContainerCreateChildContext): Promise<BlobTreeItem> {
    let blobPath: string = context.childName || await ext.ui.showInputBox({
        placeHolder: 'Enter a name for the new block blob',
        validateInput: async (name: string) => {
            let nameError = BlobContainerTreeItem.validateBlobName(name);
            if (nameError) {
                return nameError;
            } else if (await doesBlobExist(parent, name)) {
                return "A blob with this path and name already exists";
            }

            return undefined;
        }
    });

    return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
        context.showCreatingTreeItem(blobPath);
        progress.report({ message: `Azure Storage: Creating block blob '${blobPath}'` });
        await createOrUpdateBlockBlob(parent, blobPath);
        // Use the full blob path as the label since this is a newly created blob. https://github.com/microsoft/vscode-azurestorage/issues/565
        return new BlobTreeItem(parent, blobPath, parent.container, blobPath);
    });
}

export async function createOrUpdateBlockBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, name: string, text?: string | Buffer): Promise<void> {
    text = text ? text : '';
    const contentLength: number = text instanceof Buffer ? text.byteLength : text.length;
    const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(parent.root, parent.container.name);

    let properties: azureStorageBlob.BlockBlobUploadOptions | undefined = await getExistingProperties(parent, name);
    // tslint:disable: strict-boolean-expressions
    properties = properties || {};
    properties.blobHTTPHeaders = properties.blobHTTPHeaders || {};
    properties.blobHTTPHeaders.blobContentType = properties.blobHTTPHeaders.blobContentType || mime.getType(name) || undefined;
    // tslint:enable: strict-boolean-expressions

    await containerClient.uploadBlockBlob(name, text, contentLength, properties);
}

export async function doesBlobExist(treeItem: BlobContainerTreeItem | BlobDirectoryTreeItem, blobPath: string): Promise<boolean> {
    const blobClient: azureStorageBlob.BlobClient = createBlobClient(treeItem.root, treeItem.container.name, blobPath);
    return blobClient.exists();
}

export async function getExistingProperties(parent: BlobTreeItem | BlobContainerTreeItem | BlobDirectoryTreeItem, blobPath: string): Promise<azureStorageBlob.BlockBlobUploadOptions | undefined> {
    const blockBlobClient: azureStorageBlob.BlockBlobClient = createBlockBlobClient(parent.root, parent.container.name, blobPath);
    if (await blockBlobClient.exists()) {
        let existingProperties: azureStorageBlob.BlobGetPropertiesResponse = await blockBlobClient.getProperties();
        return {
            metadata: existingProperties.metadata,
            blobHTTPHeaders: {
                blobCacheControl: existingProperties.cacheControl,
                blobContentType: existingProperties.contentType,
                blobContentEncoding: existingProperties.contentEncoding,
                blobContentLanguage: existingProperties.contentLanguage,
                blobContentDisposition: existingProperties.contentDisposition,
                blobContentMD5: undefined // Needs to be filled in by SDK
            }
        };
    }

    return undefined;
}

// Implements `onProgress` callbacks used by @azure/storage-blob for blob uploads/downloads
export class TransferProgress {
    private message: string = '';
    private percentage: number = 0;
    private lastPercentage: number = 0;
    private lastUpdated: number = Date.now();

    constructor(
        private readonly updateTimerMs: number = 200
    ) { }

    public reportToNotification(blobPath: string, loadedBytes: number, totalBytes: number, notificationProgress: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>): void {
        // This function is called very frequently and calls made to notificationProgress.report too rapidly result in incremental
        // progress not displaying in the notification window. So debounce calls to notificationProgress.report
        if (this.lastUpdated + this.updateTimerMs < Date.now()) {
            this.preReport(blobPath, loadedBytes, totalBytes);
            notificationProgress.report({ message: this.message, increment: this.percentage - this.lastPercentage });
            this.postReport();
        }
    }

    public reportToOutputWindow(blobPath: string, loadedBytes: number, totalBytes: number): void {
        this.preReport(blobPath, loadedBytes, totalBytes);
        ext.outputChannel.appendLine(this.message);
        this.postReport();
    }

    private preReport(blobPath: string, loadedBytes: number, totalBytes: number): void {
        this.percentage = Math.trunc((loadedBytes / totalBytes) * 100);
        this.message = `${blobPath}: ${loadedBytes}/${totalBytes} (${this.percentage}%)`;
    }

    private postReport(): void {
        this.lastPercentage = this.percentage;
        this.lastUpdated = Date.now();
    }
}

export interface IBlobContainerCreateChildContext extends IActionContext {
    childType: string;
    childName: string;
}
