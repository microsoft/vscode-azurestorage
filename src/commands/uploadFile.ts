/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { stat } from "fs-extra";
import { basename, dirname } from "path";
import { OpenDialogOptions, Uri, window } from "vscode";
import { IActionContext } from "vscode-azureextensionui";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { doesBlobExist } from "../utils/blobUtils";
import { doesFileExist } from "../utils/fileUtils";
import { Limits } from "../utils/limits";
import { localize } from "../utils/localize";
import { warnFileAlreadyExists } from "../utils/uploadUtils";
import { validateFileName } from "../utils/validateNames";

let lastUploadFolder: Uri;

export interface IExistingFileContext extends IActionContext {
    localFilePath: string;
    remoteFilePath: string;
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

        await checkCanUpload(context, treeItem, localFilePath);

        const remoteFilePath = await window.showInputBox({
            prompt: localize('enterNameForFile', 'Enter a name for the uploaded file'),
            value: basename(localFilePath),
            validateInput: treeItem instanceof BlobContainerTreeItem ? BlobContainerTreeItem.validateBlobName : validateFileName
        });
        if (remoteFilePath) {
            if (treeItem instanceof BlobContainerTreeItem ? await doesBlobExist(treeItem, remoteFilePath) : await doesFileExist(basename(remoteFilePath), treeItem, dirname(remoteFilePath), treeItem.shareName)) {
                await warnFileAlreadyExists(remoteFilePath);
                const id: string = `${treeItem.fullId}/${remoteFilePath}`;
                try {
                    const result = await treeItem.treeDataProvider.findTreeItem(id, context);
                    if (result) {
                        // A treeItem for this file already exists, no need to do anything with the tree, just upload
                        await treeItem.uploadLocalFile(localFilePath, remoteFilePath);
                        return;
                    }
                } catch (err) {
                    // https://github.com/Microsoft/vscode-azuretools/issues/85
                }
            }

            await treeItem.createChild(<IExistingFileContext>{ ...context, remoteFilePath, localFilePath });
        }
    }
}

async function checkCanUpload(context: IActionContext, treeItem: BlobContainerTreeItem | FileShareTreeItem, localPath: string): Promise<void> {
    const size = (await stat(localPath)).size;
    context.telemetry.measurements.fileUploadSize = size;
    if (size > Limits.maxUploadDownloadSizeBytes) {
        context.telemetry.properties.fileTooLargeForUpload = 'true';
        await Limits.askOpenInStorageExplorer(
            context,
            `Please use Storage Explorer to upload files larger than ${Limits.maxUploadDownloadSizeMB}MB.`,
            treeItem.root.storageAccountId,
            treeItem.root.subscriptionId,
            treeItem instanceof BlobContainerTreeItem ? 'Azure.BlobContainer' : 'Azure.FileShare',
            treeItem instanceof BlobContainerTreeItem ? treeItem.container.name : treeItem.shareName);
    }
}
