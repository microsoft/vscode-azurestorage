/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from 'path';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { getBlobPath } from '../utils/blobUtils';
import { getFileName } from '../utils/fileUtils';
import { localize } from '../utils/localize';
import { getUploadingMessage, upload, uploadLocalFolder } from '../utils/uploadUtils';

export async function uploadFolder(actionContext: IActionContext, target?: vscode.Uri | BlobContainerTreeItem | FileShareTreeItem): Promise<void> {
    let uri: vscode.Uri;
    if (target instanceof vscode.Uri) {
        uri = target;
        if (uri.scheme === 'azurestorage') {
            throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
        }
    } else {
        uri = (await ext.ui.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: upload
        }))[0];
    }

    let treeItem: BlobContainerTreeItem | FileShareTreeItem;
    if (target instanceof BlobContainerTreeItem || target instanceof FileShareTreeItem) {
        treeItem = target;
    } else {
        treeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext);
    }

    const title: string = getUploadingMessage(uri.fsPath, treeItem.label);
    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (notificationProgress, cancellationToken) => {
        const sourcePath: string = uri.fsPath;
        await showUploadWarning(localize('uploadWillOverwrite', 'Uploading "{0}" will overwrite any existing resources with the same name.', sourcePath));

        const destFileName: string = basename(sourcePath);
        const destPath: string = treeItem instanceof BlobContainerTreeItem ?
            await getBlobPath(treeItem, destFileName) :
            await getFileName(treeItem, '', treeItem.shareName, destFileName);

        // AzCopy recognizes folders as a resource when uploading to file shares. So only set `countFoldersAsResources=true` in that case
        await uploadLocalFolder(actionContext, treeItem, sourcePath, destPath, notificationProgress, cancellationToken, destPath, treeItem instanceof FileShareTreeItem);
    });

    const success: string = localize('successfullyUploaded', 'Successfully uploaded to "{0}"', treeItem.label);
    ext.outputChannel.appendLog(success);
    vscode.window.showInformationMessage(success);
}

async function showUploadWarning(message: string): Promise<void> {
    await ext.ui.showWarningMessage(message, { modal: true }, { title: localize('upload', 'Upload') });
}
