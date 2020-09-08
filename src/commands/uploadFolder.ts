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
import { getUploadingMessageWithSource, upload, uploadLocalFolder } from '../utils/uploadUtils';

export async function uploadFolder(
    actionContext: IActionContext,
    treeItem?: BlobContainerTreeItem | FileShareTreeItem,
    uri?: vscode.Uri,
    notificationProgress?: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>,
    cancellationToken?: vscode.CancellationToken,
    suppressPrompts?: boolean
): Promise<void> {
    if (uri?.scheme === 'azurestorage') {
        throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
    }

    // tslint:disable: strict-boolean-expressions
    uri = uri || (await ext.ui.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
        openLabel: upload
    }))[0];

    treeItem = treeItem || <BlobContainerTreeItem | FileShareTreeItem>(await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext));
    // tslint:enable: strict-boolean-expressions

    const sourcePath: string = uri.fsPath;
    let destPath: string = basename(sourcePath);
    if (!suppressPrompts) {
        destPath = treeItem instanceof BlobContainerTreeItem ?
            await getBlobPath(treeItem, destPath) :
            await getFileName(treeItem, '', treeItem.shareName, destPath);
        await showUploadWarning(localize('uploadWillOverwrite', 'Uploading "{0}" will overwrite any existing resources with the same name.', sourcePath));
    }

    if (notificationProgress && cancellationToken) {
        await uploadLocalFolder(actionContext, treeItem, sourcePath, destPath, notificationProgress, cancellationToken, destPath, treeItem instanceof FileShareTreeItem);
    } else {
        const title: string = getUploadingMessageWithSource(sourcePath, treeItem.label);
        await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
            // AzCopy recognizes folders as a resource when uploading to file shares. So only set `countFoldersAsResources=true` in that case
            // tslint:disable-next-line:no-non-null-assertion
            await uploadLocalFolder(actionContext, treeItem!, sourcePath, destPath, newNotificationProgress, newCancellationToken, destPath, treeItem instanceof FileShareTreeItem);
        });
    }
}

async function showUploadWarning(message: string): Promise<void> {
    await ext.ui.showWarningMessage(message, { modal: true }, { title: localize('upload', 'Upload') });
}
