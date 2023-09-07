/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ContainerClient } from "@azure/storage-blob";
import { ShareClient } from "@azure/storage-file-share";
import { nonNullProp } from "@microsoft/vscode-azext-utils";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";
import { IStorageTreeItem } from "../../tree/IStorageTreeItem";
import { createBlobContainerClient } from "../../utils/blobUtils";
import { createShareClient } from "../../utils/fileUtils";

export function getResourceUri(treeItem: IStorageTreeItem & Partial<{ shareName?: string }>): string {
    if (treeItem instanceof BlobTreeItem || treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem) {
        const containerClient: ContainerClient = createBlobContainerClient(treeItem.root, treeItem.container.name);
        return containerClient.url;
    } else {
        // if not a Blob, then one of these types: FileTreeItem | DirectoryTreeItem | FileShareTreeItem
        const shareClient: ShareClient = createShareClient(treeItem.root, nonNullProp(treeItem, 'shareName'));
        return shareClient.url;
    }
}
