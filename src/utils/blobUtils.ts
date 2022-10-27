/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PageSettings } from '@azure/core-paging';
import * as azureStorageBlob from '@azure/storage-blob';
import { AzExtTreeItem, IActionContext, ICreateChildImplContext } from '@microsoft/vscode-azext-utils';
import * as mime from "mime";
import * as path from 'path';
import * as vscode from 'vscode';
import { maxPageSize } from '../constants';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { BlobDirectoryTreeItem } from '../tree/blob/BlobDirectoryTreeItem';
import { BlobTreeItem } from '../tree/blob/BlobTreeItem';
import { IStorageRoot } from "../tree/IStorageRoot";
import { localize } from './localize';

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
    const settings: PageSettings = {
        continuationToken,
        // https://github.com/Azure/Azurite/issues/605
        maxPageSize: parent.root.isEmulated ? maxPageSize * 10 : maxPageSize
    };
    const response: AsyncIterableIterator<azureStorageBlob.ContainerListBlobHierarchySegmentResponse> = containerClient.listBlobsByHierarchy(path.posix.sep, { prefix }).byPage(settings);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const responseValue: azureStorageBlob.ListBlobsHierarchySegmentResponse = (await response.next()).value;
    continuationToken = responseValue.continuationToken;

    const children: AzExtTreeItem[] = [];
    for (const blob of responseValue.segment.blobItems) {
        // NOTE: `blob.name` as returned from Azure is actually the blob path in the container
        children.push(new BlobTreeItem(parent, blob.name, parent.container));
    }

    for (const directory of responseValue.segment.blobPrefixes || []) {
        // NOTE: `directory.name` as returned from Azure is actually the directory path in the container
        children.push(new BlobDirectoryTreeItem(parent, directory.name, parent.container));
    }

    return { children, continuationToken };
}

// Currently only supports creating block blobs
export async function createChildAsNewBlockBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, context: ICreateChildImplContext & IBlobContainerCreateChildContext): Promise<BlobTreeItem> {
    const blobPath: string = context.childName || await getBlobPath(context, parent.root, parent.container.name);

    return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
        context.showCreatingTreeItem(blobPath);
        progress.report({ message: `Azure Storage: Creating block blob '${blobPath}'` });
        await createOrUpdateBlockBlob(parent.root, parent.container.name, blobPath);
        return new BlobTreeItem(parent, blobPath, parent.container);
    });
}

export async function createOrUpdateBlockBlob(root: IStorageRoot, containerName: string, name: string, text?: string | Buffer): Promise<void> {
    text = text ? text : '';
    const contentLength: number = text instanceof Buffer ? text.byteLength : text.length;
    const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(root, containerName);

    let properties: azureStorageBlob.BlockBlobUploadOptions | undefined = await getExistingProperties(root, containerName, name);
    properties = properties || {};
    properties.blobHTTPHeaders = properties.blobHTTPHeaders || {};
    properties.blobHTTPHeaders.blobContentType = properties.blobHTTPHeaders.blobContentType || mime.getType(name) || undefined;

    await containerClient.uploadBlockBlob(name, text, contentLength, properties);
}

export async function doesBlobExist(root: IStorageRoot, containerName: string, blobPath: string): Promise<boolean> {
    const blobClient: azureStorageBlob.BlobClient = createBlobClient(root, containerName, blobPath);
    return blobClient.exists();
}

export async function doesBlobDirectoryExist(root: IStorageRoot, containerName: string, blobDirectoryName: string): Promise<boolean> {
    const sep: string = path.posix.sep;
    if (!blobDirectoryName.endsWith(sep)) {
        blobDirectoryName = `${blobDirectoryName}${sep}`;
    }

    const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(root, containerName);
    const response: AsyncIterableIterator<azureStorageBlob.ContainerListBlobHierarchySegmentResponse> = containerClient.listBlobsByHierarchy(sep, { prefix: blobDirectoryName }).byPage({ maxPageSize: 1 });

    for await (const responseValue of response) {
        if (responseValue.segment.blobItems.length || responseValue.segment.blobPrefixes?.length) {
            return true;
        }
    }

    return false;
}

export async function getExistingProperties(root: IStorageRoot, containerName: string, blobPath: string): Promise<azureStorageBlob.BlockBlobUploadOptions | undefined> {
    const blockBlobClient: azureStorageBlob.BlockBlobClient = createBlockBlobClient(root, containerName, blobPath);
    if (await blockBlobClient.exists()) {
        const existingProperties: azureStorageBlob.BlobGetPropertiesResponse = await blockBlobClient.getProperties();
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

export async function getBlobPath(context: IActionContext, root: IStorageRoot, containerName: string, value?: string): Promise<string> {
    return await context.ui.showInputBox({
        value,
        placeHolder: localize('enterNameForNewBlockBlob', 'Enter a name for the new block blob'),
        validateInput: async (name: string) => {
            const nameError = BlobContainerTreeItem.validateBlobName(name);
            if (nameError) {
                return nameError;
            } else if (await doesBlobExist(root, containerName, name)) {
                return localize('aBlobWithThisPathAndNameAlreadyExists', 'A blob with this path and name already exists');
            }

            return undefined;
        }
    });
}

export interface IBlobContainerCreateChildContext extends IActionContext {
    childType: string;
    childName: string;
}
