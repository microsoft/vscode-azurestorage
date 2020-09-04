/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from "path";
import { Uri, window } from "vscode";
import { IActionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { getBlobPath } from "../utils/blobUtils";
import { getFileName } from "../utils/fileUtils";
import { upload } from "../utils/uploadUtils";

let lastUriUpload: Uri;

export interface IExistingFileContext extends IActionContext {
    localFilePath: string;
    remoteFilePath: string;
}

export async function uploadFiles(context: IActionContext, treeItem?: BlobContainerTreeItem | FileShareTreeItem, uris?: Uri[]): Promise<void> {
    if (!uris) {
        uris = await window.showOpenDialog(
            {
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                defaultUri: lastUriUpload,
                filters: {
                    "All files": ['*']
                },
                openLabel: upload
            }
        );
    }

    if (!(treeItem instanceof BlobContainerTreeItem) && !(treeItem instanceof FileShareTreeItem)) {
        treeItem = <BlobContainerTreeItem | FileShareTreeItem>(await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], context));
    }

    if (uris && uris.length) {
        lastUriUpload = uris[0];
        for (const uri of uris) {
            const localFilePath: string = uri.fsPath;
            let remoteFilePath: string | undefined = basename(localFilePath);

            // Only prompt for upload name if we're uploading a single file
            if (uris.length === 1) {
                remoteFilePath = treeItem instanceof BlobContainerTreeItem ?
                    await getBlobPath(treeItem, remoteFilePath) :
                    await getFileName(treeItem, '', treeItem.shareName, remoteFilePath);
            }

            if (remoteFilePath) {
                const id: string = `${treeItem.fullId}/${remoteFilePath}`;
                const result = await treeItem.treeDataProvider.findTreeItem(id, context);
                if (result) {
                    // A treeItem for this file already exists, no need to do anything with the tree, just upload
                    await treeItem.uploadLocalFile(context, localFilePath, remoteFilePath);
                    continue;
                }
                await treeItem.createChild(<IExistingFileContext>{ ...context, remoteFilePath, localFilePath });
            }
        }
    }
}
