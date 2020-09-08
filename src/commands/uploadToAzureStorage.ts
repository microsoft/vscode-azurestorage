/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { stat } from 'fs-extra';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { localize } from '../utils/localize';
import { getUploadingMessage, showUploadWarning } from '../utils/uploadUtils';
import { uploadFiles } from './uploadFile';
import { uploadFolder } from './uploadFolder';

export async function uploadToAzureStorage(actionContext: IActionContext, _firstSelection: vscode.Uri, uris: vscode.Uri[]): Promise<void> {
    if (uris.length && uris[0].scheme === 'azurestorage') {
        throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
    }

    const folderUris: vscode.Uri[] = [];
    const fileUris: vscode.Uri[] = [];
    for (const uri of uris) {
        if ((await stat(uri.fsPath)).isDirectory()) {
            folderUris.push(uri);
        } else {
            fileUris.push(uri);
        }
    }

    const treeItem: BlobContainerTreeItem | FileShareTreeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext);
    const suppressPrompts: boolean = uris.length > 1;
    const title: string = getUploadingMessage(treeItem.label);
    await showUploadWarning(localize('uploadingToWillOverwrite', 'Uploading to "{0}" will overwrite any existing resources with the same name.', treeItem.label));
    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (notificationProgress, cancellationToken) => {
        for (const folderUri of folderUris) {
            await uploadFolder(actionContext, treeItem, folderUri, notificationProgress, cancellationToken, suppressPrompts);
        }

        await uploadFiles(actionContext, treeItem, fileUris, notificationProgress, cancellationToken, suppressPrompts);
    });

    const success: string = localize('successfullyUploaded', 'Successfully uploaded to "{0}"', treeItem.label);
    ext.outputChannel.appendLog(success);
    vscode.window.showInformationMessage(success);
}
