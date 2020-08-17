/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename, dirname } from "path";
import { OpenDialogOptions, Uri, window } from "vscode";
import { IActionContext } from "vscode-azureextensionui";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { shouldUseAzCopy } from "../utils/azCopyUtils";
import { doesBlobExist } from "../utils/blobUtils";
import { doesFileExist } from "../utils/fileUtils";
import { localize } from "../utils/localize";
import { warnFileAlreadyExists } from "../utils/uploadUtils";
import { validateFileName } from "../utils/validateNames";

let lastUploadFolder: Uri;

export interface IExistingFileContext extends IActionContext {
    localFilePath: string;
    remoteFilePath: string;
}

export interface IUploadLocalFileOptions {
    useAzCopy?: boolean;
    suppressLogs?: boolean;
}

export async function uploadFile(context: IActionContext, treeItem: BlobContainerTreeItem | FileShareTreeItem): Promise<void> {
    const uris: Uri[] | undefined = await window.showOpenDialog(
        <OpenDialogOptions>{
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            defaultUri: lastUploadFolder,
            filters: {
                "All files": ['*']
            },
            openLabel: "Upload"
        }
    );
    if (uris && uris.length) {
        const uri: Uri = uris[0];
        lastUploadFolder = uri;
        const localFilePath: string = uri.fsPath;
        const remoteFilePath = await window.showInputBox({
            prompt: localize('enterNameForFile', 'Enter a name for the uploaded file'),
            value: basename(localFilePath),
            validateInput: treeItem instanceof BlobContainerTreeItem ? BlobContainerTreeItem.validateBlobName : validateFileName
        });
        if (remoteFilePath) {
            if (treeItem instanceof BlobContainerTreeItem ? await doesBlobExist(treeItem, remoteFilePath) : await doesFileExist(basename(remoteFilePath), treeItem, dirname(remoteFilePath), treeItem.shareName)) {
                await warnFileAlreadyExists(remoteFilePath);
                const id: string = `${treeItem.fullId}/${remoteFilePath}`;
                const result = await treeItem.treeDataProvider.findTreeItem(id, context);
                if (result) {
                    // A treeItem for this file already exists, no need to do anything with the tree, just upload
                    await treeItem.uploadLocalFile(localFilePath, remoteFilePath, { useAzCopy: await shouldUseAzCopy(context, localFilePath) });
                    return;
                }
            }

            await treeItem.createChild(<IExistingFileContext>{ ...context, remoteFilePath, localFilePath });
        }
    }
}
