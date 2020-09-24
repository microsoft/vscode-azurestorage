/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { stat } from 'fs-extra';
import { dirname } from 'path';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { throwIfCanceled } from '../utils/errorUtils';
import { localize } from '../utils/localize';
import { getUploadingMessage, OverwriteChoice, promptForDestinationDirectory, shouldUploadUri } from '../utils/uploadUtils';
import { uploadFiles } from './uploadFiles';
import { uploadFolder } from './uploadFolder';

export async function uploadToAzureStorage(actionContext: IActionContext, _firstSelection: vscode.Uri, uris: vscode.Uri[]): Promise<void> {
    const treeItem: BlobContainerTreeItem | FileShareTreeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext);
    const destinationDirectory: string = await promptForDestinationDirectory();
    let fileUris: vscode.Uri[] = [];
    let folderUris: vscode.Uri[] = [];
    const folderPathSet: Set<string> = new Set();
    let overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };

    for (const uri of uris) {
        if (uri.scheme === 'azurestorage') {
            throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
        }

        if (await shouldUploadUri(treeItem, uri, overwriteChoice, destinationDirectory)) {
            if ((await stat(uri.fsPath)).isDirectory()) {
                folderUris.push(uri);
                folderPathSet.add(uri.fsPath);
            } else {
                fileUris.push(uri);
            }
        }
    }

    // Only upload files and folders if their containing folder isn't already being uploaded.
    fileUris = fileUris.filter(fileUri => !folderPathSet.has(dirname(fileUri.fsPath)));
    folderUris = folderUris.filter(folderUri => !folderPathSet.has(dirname(folderUri.fsPath)));

    if (!folderUris.length && !fileUris.length) {
        // No URIs to upload
        return;
    }

    const title: string = getUploadingMessage(treeItem.label);
    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (notificationProgress, cancellationToken) => {
        for (const folderUri of folderUris) {
            throwIfCanceled(cancellationToken, actionContext.telemetry.properties, 'uploadToAzureStorage');
            await uploadFolder(actionContext, treeItem, folderUri, notificationProgress, cancellationToken, destinationDirectory);
        }

        await uploadFiles(actionContext, treeItem, fileUris, notificationProgress, cancellationToken, destinationDirectory);
    });

    await ext.tree.refresh(treeItem);
    const complete: string = localize('uploadComplete', 'Upload to "{0}" is complete.', treeItem.label);
    ext.outputChannel.appendLog(complete);
    vscode.window.showInformationMessage(complete);
}
