/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { AccountSASPermissions, AccountSASSignatureValues, ContainerClient } from "@azure/storage-blob";
import { ShareClient } from "@azure/storage-file-share";
import { sep } from "path";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { FileTreeItem } from "../../tree/fileShare/FileTreeItem";
import { createBlobContainerClient } from "../../utils/blobUtils";
import { createShareClient } from "../../utils/fileUtils";

const threeDaysInMS: number = 1000 * 60 * 60 * 24 * 3;

export function createAzCopyLocalLocation(path: string, isFolder?: boolean): ILocalLocation {
    if (isFolder && !path.endsWith(sep)) {
        path += sep;
    }
    return { type: 'Local', path, useWildCard: !!isFolder };
}

export function createAzCopyRemoteLocation(treeItem: BlobTreeItem | BlobContainerTreeItem | FileTreeItem | FileShareTreeItem, path: string): IRemoteSasLocation {
    let resourceUri: string;
    if (treeItem instanceof BlobTreeItem || treeItem instanceof BlobContainerTreeItem) {
        const containerClient: ContainerClient = createBlobContainerClient(treeItem.root, treeItem.container.name);
        resourceUri = containerClient.url;
    } else {
        const shareClient: ShareClient = createShareClient(treeItem.root, treeItem.shareName);
        resourceUri = shareClient.url;
    }

    const accountSASSignatureValues: AccountSASSignatureValues = {
        expiresOn: new Date(Date.now() + threeDaysInMS),
        permissions: AccountSASPermissions.parse('rwl'), // read, write, list
        services: 'bf', // blob, file
        resourceTypes: 'o' // object
    };
    const sasToken: string = treeItem.root.generateSasToken(accountSASSignatureValues);
    // Ensure path begins with '/' to transfer properly
    path = path[0] === '/' ? path : `/${path}`;
    return { type: 'RemoteSas', sasToken, resourceUri, path, useWildCard: false };
}
