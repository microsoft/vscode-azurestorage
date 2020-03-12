/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { TransferProgress } from '../TransferProgress';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { listFilePathsWithAzureSeparator } from '../utils/fs';
import { localize } from '../utils/localize';
import { uploadFiles } from '../utils/uploadUtils';
import { selectWorkspaceItem } from '../utils/workspaceUtils';

export async function uploadToAzureStorage(actionContext: IActionContext, target?: vscode.Uri): Promise<void> {
    let resourcePath: string;
    if (target) {
        if (target.scheme === 'azurestorage') {
            throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
        }

        resourcePath = target.fsPath;
    } else {
        resourcePath = await selectWorkspaceItem(
            ext.ui,
            localize('selectResourceToUpload', 'Select resource to upload'),
            {
                canSelectFiles: true,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
                openLabel: localize('select', 'Select')
            });
    }

    let treeItem: BlobContainerTreeItem | FileShareTreeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.baseContextValue, FileShareTreeItem.baseContextValue], actionContext);
    let filePathsToUpload: string[];
    let parentDirectory: string;
    let destinationName: string;

    if ((await fse.stat(resourcePath)).isDirectory()) {
        filePathsToUpload = await listFilePathsWithAzureSeparator(resourcePath);
        parentDirectory = resourcePath;
    } else {
        filePathsToUpload = [resourcePath];
        parentDirectory = path.dirname(resourcePath);
    }

    if (treeItem instanceof BlobContainerTreeItem) {
        destinationName = treeItem.container.name;
    } else {
        destinationName = treeItem.shareName;
    }

    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title: `Uploading to ${destinationName} from ${parentDirectory}` }, async (notificationProgress, cancellationToken) => {
        const transferProgress = new TransferProgress(filePathsToUpload.length);
        await uploadFiles(treeItem, parentDirectory, '', filePathsToUpload, actionContext.telemetry.properties, transferProgress, notificationProgress, cancellationToken);
    });
}
