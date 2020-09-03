/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import { basename } from 'path';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { localize } from '../utils/localize';
import { uploadFiles } from '../utils/uploadUtils';

export async function uploadToAzureStorage(actionContext: IActionContext, target?: vscode.Uri): Promise<void> {
    let resourceUris: vscode.Uri[];
    if (target) {
        if (target.scheme === 'azurestorage') {
            throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
        }

        resourceUris = [vscode.Uri.file(target.fsPath)];
    } else {
        resourceUris = await ext.ui.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: true,
            canSelectMany: true,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: localize('select', 'Select')
        });
    }

    const multiResourceUpload: boolean = resourceUris.length > 1;
    if (multiResourceUpload) {
        await showUploadWarning(localize('uploadWillOverwrite', 'Uploading multiple files/folders will overwrite any existing resources with the same name.'));
    }

    let treeItem: BlobContainerTreeItem | FileShareTreeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext);
    const title: string = localize('uploading', 'Uploading resources to "{0}"', treeItem.label);
    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (notificationProgress, cancellationToken) => {
        for (const resourceUri of resourceUris) {
            const resourcePath: string = resourceUri.fsPath;
            if ((await fse.stat(resourcePath)).isDirectory()) {
                if (!multiResourceUpload) {
                    await showUploadWarning(localize('uploadWillOverwrite', 'Uploading "{0}" will overwrite any existing resources with the same name.', resourcePath));
                }

                // AzCopy recognizes folders as a resource when uploading to file shares. So only set `countFoldersAsResources=true` in that case
                await uploadFiles(actionContext, treeItem, resourcePath, undefined, notificationProgress, cancellationToken, basename(resourcePath), treeItem instanceof FileShareTreeItem, multiResourceUpload);
            } else {
                await treeItem.uploadLocalFile(actionContext, resourcePath, undefined, multiResourceUpload);
            }
        }
    });

    const success: string = localize('successfullyUploaded', 'Successfully uploaded to "{0}"', treeItem.label);
    ext.outputChannel.appendLog(success);
    vscode.window.showInformationMessage(success);
}

async function showUploadWarning(message: string): Promise<void> {
    await ext.ui.showWarningMessage(message, { modal: true }, { title: localize('upload', 'Upload') });
}
