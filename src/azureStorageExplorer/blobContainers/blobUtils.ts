/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as mime from "mime";
import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, IActionContext, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { BlobContainerTreeItem } from './blobContainerNode';
import { BlobDirectoryTreeItem } from './blobDirectoryNode';
import { BlobTreeItem } from './blobNode';

export async function loadMoreBlobChildren(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, continuationToken?: string): Promise<{ children: AzExtTreeItem[], continuationToken?: string }> {
    const dirPath = parent instanceof BlobDirectoryTreeItem ? parent.dirPath : '';
    const listOptions = dirPath ? { prefix: dirPath } : undefined;
    const containerClient = parent.root.createBlobContainerClient(parent.container.name);
    let response = containerClient.listBlobsByHierarchy('/', listOptions).byPage({ continuationToken, maxPageSize: 50 });

    // tslint:disable-next-line: no-unsafe-any
    let responseValue: azureStorageBlob.ListBlobsHierarchySegmentResponse = (await response.next()).value;
    continuationToken = responseValue.continuationToken;

    let children: AzExtTreeItem[] = [];
    for (const blob of responseValue.segment.blobItems) {
        blob.name = parent instanceof BlobDirectoryTreeItem ? path.basename(blob.name) : blob.name;
        children.push(new BlobTreeItem(parent, dirPath, blob, parent.container));
    }

    // tslint:disable-next-line: strict-boolean-expressions
    for (const directory of responseValue.segment.blobPrefixes || []) {
        directory.name = path.basename(directory.name.substring(0, directory.name.length - 1));
        children.push(new BlobDirectoryTreeItem(parent, dirPath, directory, parent.container));
    }

    return { children, continuationToken };
}

// Currently only supports creating block blobs
export async function createChildAsNewBlockBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, context: ICreateChildImplContext & IBlobContainerCreateChildContext): Promise<BlobTreeItem> {
    let blobName: string | undefined = context.childName;
    if (!blobName) {
        blobName = await vscode.window.showInputBox({
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
    }

    if (blobName) {
        let blobNameString: string = <string>blobName;
        return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(blobNameString);
            progress.report({ message: `Azure Storage: Creating block blob '${blobNameString}'` });
            const blob = await createBlockBlob(parent, blobNameString);
            blob.name = parent instanceof BlobDirectoryTreeItem ? path.basename(blob.name) : blob.name;
            return new BlobTreeItem(parent, parent instanceof BlobDirectoryTreeItem ? parent.dirPath : '', blob, parent.container);
        });
    }

    throw new UserCancelledError();
}

export async function createBlockBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, name: string, text?: string | Buffer): Promise<azureStorageBlob.BlobItem> {
    text = text ? text : '';
    const contentLength = text instanceof Buffer ? text.byteLength : text.length;
    const containerClient = parent.root.createBlobContainerClient(parent.container.name);

    let properties = await getExistingProperties(parent, name);
    // tslint:disable: strict-boolean-expressions
    properties = properties || {};
    properties.blobHTTPHeaders = properties.blobHTTPHeaders || {};
    properties.blobHTTPHeaders.blobContentType = properties.blobHTTPHeaders.blobContentType || mime.getType(name) || undefined;
    // tslint:enable: strict-boolean-expressions

    await containerClient.uploadBlockBlob(name, text, contentLength, properties);
    return await getBlob(parent, name);
}

export async function doesBlobExist(treeItem: BlobContainerTreeItem | BlobDirectoryTreeItem, blobPath: string): Promise<boolean> {
    const blobClient = treeItem.root.createBlobClient(treeItem.container.name, blobPath);
    return blobClient.exists();
}

export async function getBlob(parent: BlobContainerTreeItem | BlobDirectoryTreeItem, name: string): Promise<azureStorageBlob.BlobItem> {
    const containerClient = parent.root.createBlobContainerClient(parent.container.name);
    let response = containerClient.listBlobsFlat().byPage();

    // tslint:disable-next-line: no-unsafe-any
    let responseValue: azureStorageBlob.ListBlobsFlatSegmentResponse = (await response.next()).value;
    for (let blob of responseValue.segment.blobItems) {
        if (blob.name === name) {
            return blob;
        }
    }

    throw new Error(`Could not find blob ${name}`);
}

export async function getExistingProperties(parent: BlobTreeItem | BlobContainerTreeItem | BlobDirectoryTreeItem, blobPath: string): Promise<azureStorageBlob.BlockBlobUploadOptions | undefined> {
    const blockBlobClient = parent.root.createBlockBlobClient(parent.container.name, blobPath);
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

export interface IBlobContainerCreateChildContext extends IActionContext {
    childType: string;
    childName: string;
}
