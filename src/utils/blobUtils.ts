/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BlobClient, BlobGetPropertiesResponse, BlobServiceClient, BlockBlobClient, BlockBlobUploadOptions, ContainerClient, ContainerListBlobHierarchySegmentResponse, ListBlobsHierarchySegmentResponse } from '@azure/storage-blob';

import { PageSettings } from '@azure/core-paging';
import { AzExtTreeItem, IActionContext, ICreateChildImplContext } from '@microsoft/vscode-azext-utils';
import * as mime from "mime";
import * as path from 'path';
import * as vscode from 'vscode';
import { maxPageSize } from '../constants';
import { IStorageRoot } from "../tree/IStorageRoot";
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { BlobDirectoryTreeItem } from '../tree/blob/BlobDirectoryTreeItem';
import { BlobTreeItem } from '../tree/blob/BlobTreeItem';
import { localize } from './localize';

export async function createBlobContainerClient(root: IStorageRoot, containerName: string): Promise<ContainerClient> {
    const blobServiceClient: BlobServiceClient = await root.createBlobServiceClient();
    return blobServiceClient.getContainerClient(containerName);
}

export async function createBlobClient(root: IStorageRoot, containerName: string, blobName: string): Promise<BlobClient> {
    const blobContainerClient: ContainerClient = await createBlobContainerClient(root, containerName);
    return blobContainerClient.getBlobClient(blobName);
}

export async function createBlockBlobClient(root: IStorageRoot, containerName: string, blobName: string): Promise<BlockBlobClient> {
    const blobContainerClient: ContainerClient = await createBlobContainerClient(root, containerName);
    return blobContainerClient.getBlockBlobClient(blobName);
}

export async function loadMoreBlobChildren(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, continuationToken?: string): Promise<{ children: AzExtTreeItem[], continuationToken?: string }> {
    const prefix: string | undefined = parent instanceof BlobDirectoryTreeItem ? parent.dirPath : undefined;
    const containerClient: ContainerClient = await createBlobContainerClient(parent.root, parent.container.name);
    const settings: PageSettings = {
        continuationToken,
        // https://github.com/Azure/Azurite/issues/605
        maxPageSize: parent.root.isEmulated ? maxPageSize * 10 : maxPageSize
    };
    const response: AsyncIterableIterator<ContainerListBlobHierarchySegmentResponse> = containerClient.listBlobsByHierarchy(path.posix.sep, { prefix }).byPage(settings);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const responseValue: ListBlobsHierarchySegmentResponse = (await response.next()).value;
    continuationToken = responseValue.continuationToken;

    const children: AzExtTreeItem[] = [];
    for (const blob of responseValue.segment.blobItems) {
        // NOTE: `blob.name` as returned from Azure is actually the blob path in the container
        const innerContainerClient = await createBlobContainerClient(parent.root, blob.name);
        children.push(new BlobTreeItem(parent, blob.name, parent.container, innerContainerClient.url));
    }

    for (const directory of responseValue.segment.blobPrefixes || []) {
        // NOTE: `directory.name` as returned from Azure is actually the directory path in the container
        const innerContainerClient = await createBlobContainerClient(parent.root, directory.name);
        children.push(new BlobDirectoryTreeItem(parent, directory.name, parent.container, innerContainerClient.url));
    }

    return { children, continuationToken };
}

// Currently only supports creating block blobs
export async function createChildAsNewBlockBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, context: ICreateChildImplContext & IBlobContainerCreateChildContext): Promise<BlobTreeItem> {
    const blobPath: string = context.childName ?? await getBlobPath(context, parent);

    return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
        context.showCreatingTreeItem(blobPath);
        progress.report({ message: `Azure Storage: Creating block blob '${blobPath}'` });
        await createOrUpdateBlockBlob(parent, blobPath, context?.contents || '');
        const client = await createBlobContainerClient(parent.root, parent.container.name);
        return new BlobTreeItem(parent, blobPath, parent.container, client.url);
    });
}

export async function createOrUpdateBlockBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, name: string, text?: string | Buffer): Promise<void> {
    text = text ? text : '';
    const contentLength: number = text instanceof Buffer ? text.byteLength : text.length;
    const containerClient: ContainerClient = await createBlobContainerClient(parent.root, parent.container.name);

    let properties: BlockBlobUploadOptions | undefined = await getExistingProperties(parent, name);
    properties = properties || {};
    properties.blobHTTPHeaders = properties.blobHTTPHeaders || {};
    properties.blobHTTPHeaders.blobContentType = properties.blobHTTPHeaders.blobContentType || mime.getType(name) || undefined;

    await containerClient.uploadBlockBlob(name, text, contentLength, properties);
}

export async function doesBlobExist(treeItem: BlobContainerTreeItem | BlobDirectoryTreeItem, blobPath: string): Promise<boolean> {
    const blobClient: BlobClient = await createBlobClient(treeItem.root, treeItem.container.name, blobPath);
    return blobClient.exists();
}

export async function doesBlobDirectoryExist(treeItem: BlobContainerTreeItem | BlobDirectoryTreeItem, blobDirectoryName: string): Promise<boolean> {
    const sep: string = path.posix.sep;
    if (!blobDirectoryName.endsWith(sep)) {
        blobDirectoryName = `${blobDirectoryName}${sep}`;
    }

    const containerClient: ContainerClient = await createBlobContainerClient(treeItem.root, treeItem.container.name);
    const response: AsyncIterableIterator<ContainerListBlobHierarchySegmentResponse> = containerClient.listBlobsByHierarchy(sep, { prefix: blobDirectoryName }).byPage({ maxPageSize: 1 });

    for await (const responseValue of response) {
        if (responseValue.segment.blobItems.length || responseValue.segment.blobPrefixes?.length) {
            return true;
        }
    }

    return false;
}

export async function getExistingProperties(parent: BlobTreeItem | BlobContainerTreeItem | BlobDirectoryTreeItem, blobPath: string): Promise<BlockBlobUploadOptions | undefined> {
    const blockBlobClient: BlockBlobClient = await createBlockBlobClient(parent.root, parent.container.name, blobPath);
    if (await blockBlobClient.exists()) {
        const existingProperties: BlobGetPropertiesResponse = await blockBlobClient.getProperties();
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

export async function getBlobPath(context: IActionContext, parent: BlobContainerTreeItem | BlobDirectoryTreeItem, value?: string): Promise<string> {
    return await context.ui.showInputBox({
        value,
        placeHolder: localize('enterNameForNewBlockBlob', 'Enter a name for the new block blob'),
        validateInput: async (name: string) => {
            const nameError = BlobContainerTreeItem.validateBlobName(name);
            if (nameError) {
                return nameError;
            } else if (await doesBlobExist(parent, name)) {
                return localize('aBlobWithThisPathAndNameAlreadyExists', 'A blob with this path and name already exists');
            }

            return undefined;
        }
    });
}

export interface IBlobContainerCreateChildContext extends IActionContext {
    childType: string;
    childName: string;
    contents?: Buffer;
}
