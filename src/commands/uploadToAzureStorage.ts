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
import { doesBlobExist, getBlobPath } from '../utils/blobUtils';
import { doesFileExist, getFileName } from '../utils/fileUtils';
import { getNumResourcesInDirectory } from '../utils/fs';
import { localize } from '../utils/localize';
import { uploadFiles, warnFileAlreadyExists } from '../utils/uploadUtils';
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

    let treeItem: BlobContainerTreeItem | FileShareTreeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext);
    let destinationName: string;
    let destinationPath: string = path.basename(resourcePath);
    if (treeItem instanceof BlobContainerTreeItem) {
        destinationName = treeItem.container.name;
        destinationPath = await getBlobPath(treeItem, destinationPath);
    } else {
        destinationName = treeItem.shareName;
        destinationPath = await getFileName(treeItem, path.dirname(resourcePath), treeItem.shareName, destinationPath);
    }

    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title: `Uploading to ${destinationName} from ${resourcePath}` }, async (notificationProgress, cancellationToken) => {
        if ((await fse.stat(resourcePath)).isDirectory()) {
            const message: string = localize('uploadWillOverwrite', 'Uploading "{0}" will overwrite any existing resources with the same name.', resourcePath);
            await ext.ui.showWarningMessage(message, { modal: true }, { title: localize('upload', 'Upload') });

            // AzCopy recognizes folders as a resource when uploading to file shares. So only count folders in that case
            const numResources: number = await getNumResourcesInDirectory(resourcePath, treeItem instanceof FileShareTreeItem);
            const transferProgress = new TransferProgress(numResources);
            await uploadFiles(actionContext, treeItem, resourcePath, destinationPath, transferProgress, notificationProgress, cancellationToken);
        } else {
            if (treeItem instanceof BlobContainerTreeItem ? await doesBlobExist(treeItem, destinationPath) : await doesFileExist(path.basename(destinationPath), treeItem, path.dirname(destinationPath), treeItem.shareName)) {
                await warnFileAlreadyExists(destinationPath);
            }
            await treeItem.uploadLocalFile(actionContext, resourcePath, destinationPath);
        }
    });
}
