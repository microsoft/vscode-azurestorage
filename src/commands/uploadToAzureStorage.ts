/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { listFilePathsWithAzureSeparator } from '../utils/fs';
import { localize } from '../utils/localize';
import { showContainerShareQuickPick } from '../utils/quickPickUtils';
import { TransferProgress } from '../utils/TransferProgress';
import { uploadFiles } from '../utils/uploadUtils';

export async function uploadToAzureStorage(actionContext: IActionContext, target?: vscode.Uri): Promise<void> {
    let sourceFolderPath: string;
    if (target) {
        if (target.scheme === 'azurestorage') {
            throw new Error('Cannot upload to Azure from an Azure resource.');
        }

        sourceFolderPath = target.fsPath;
    } else {
        const browseResult: vscode.Uri[] = await ext.ui.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined
        });

        sourceFolderPath = browseResult[0].fsPath;
    }

    let treeItem: BlobContainerTreeItem | FileShareTreeItem = await showContainerShareQuickPick(actionContext, localize('selectUploadDestinationType', 'Select the upload destination type'));
    const filePathsToUpload: string[] = await listFilePathsWithAzureSeparator(sourceFolderPath);
    let destinationName: string;

    if (treeItem instanceof BlobContainerTreeItem) {
        destinationName = treeItem.container.name;
    } else {
        destinationName = treeItem.shareName;
    }

    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title: `Uploading to ${destinationName} from ${sourceFolderPath}` }, async (notificationProgress, cancellationToken) => {
        const transferProgress = new TransferProgress(filePathsToUpload.length);
        await uploadFiles(treeItem, sourceFolderPath, '', filePathsToUpload, actionContext.telemetry.properties, transferProgress, notificationProgress, cancellationToken);
    });
}
