/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { BlobContainerTreeItem, IExistingBlobContext } from '../tree/blob/BlobContainerTreeItem';
import { doesBlobExist } from '../utils/blobUtils';
import { Limits } from '../utils/limits';

let lastUploadFolder: vscode.Uri;

// This is the public entrypoint for azureStorage.uploadBlockBlob
export async function uploadBlockBlob(context: IActionContext, treeItem: BlobContainerTreeItem): Promise<void> {
    let uris = await vscode.window.showOpenDialog(
        <vscode.OpenDialogOptions>{
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
        let uri = uris[0];
        lastUploadFolder = uri;
        let filePath = uri.fsPath;

        await checkCanUpload(context, treeItem, filePath);

        let blobPath = await vscode.window.showInputBox({
            prompt: 'Enter a name for the uploaded file (may include a path)',
            value: path.basename(filePath),
            validateInput: BlobContainerTreeItem.validateBlobName
        });
        if (blobPath) {
            if (await doesBlobExist(treeItem, blobPath)) {
                const result = await vscode.window.showWarningMessage(
                    `A blob with the name "${blobPath}" already exists. Do you want to overwrite it?`,
                    { modal: true },
                    DialogResponses.yes, DialogResponses.cancel);
                if (result !== DialogResponses.yes) {
                    throw new UserCancelledError();
                }

                let blobId = `${treeItem.fullId}/${blobPath}`;
                try {
                    let blobTreeItem = await treeItem.treeDataProvider.findTreeItem(blobId, context);
                    if (blobTreeItem) {
                        // A treeItem for this blob already exists, no need to do anything with the tree, just upload
                        await treeItem.uploadLocalFile(filePath, blobPath);
                        return;
                    }
                } catch (err) {
                    // https://github.com/Microsoft/vscode-azuretools/issues/85
                }
            }

            await treeItem.createChild(<IExistingBlobContext>{ ...context, blobPath, filePath });
        }
    }

    throw new UserCancelledError();
}

async function checkCanUpload(context: IActionContext, treeItem: BlobContainerTreeItem, localPath: string): Promise<void> {
    let size = (await fse.stat(localPath)).size;
    context.telemetry.measurements.blockBlobUploadSize = size;
    if (size > Limits.maxUploadDownloadSizeBytes) {
        context.telemetry.properties.blockBlobTooLargeForUpload = 'true';
        await Limits.askOpenInStorageExplorer(
            context,
            `Please use Storage Explorer to upload files larger than ${Limits.maxUploadDownloadSizeMB}MB.`,
            treeItem.root.storageAccountId,
            treeItem.root.subscriptionId,
            'Azure.BlobContainer',
            treeItem.container.name);
    }
}
