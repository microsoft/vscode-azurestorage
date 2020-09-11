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
import { throwIfCanceled } from '../utils/errorUtils';
import { localize } from '../utils/localize';
import { nonNullValue } from '../utils/nonNull';
import { getRemoteResourceName, getUploadingMessage, OverwriteChoice, RemoteResourceNameMap } from '../utils/uploadUtils';
import { uploadFiles } from './uploadFiles';
import { uploadFolder } from './uploadFolder';

export async function uploadToAzureStorage(actionContext: IActionContext, _firstSelection: vscode.Uri, uris: vscode.Uri[]): Promise<void> {
    const treeItem: BlobContainerTreeItem | FileShareTreeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext);
    const folderUris: vscode.Uri[] = [];
    const fileUris: vscode.Uri[] = [];
    const remoteResourceNameMap: RemoteResourceNameMap = new Map();
    let overwriteChoice: OverwriteChoice = { choice: undefined };
    let remoteResourcePath: string;
    for (const uri of uris) {
        if (uri.scheme === 'azurestorage') {
            throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
        }

        remoteResourcePath = await getRemoteResourceName(treeItem, uri, overwriteChoice);
        remoteResourceNameMap.set(uri, remoteResourcePath);

        if ((await stat(uri.fsPath)).isDirectory()) {
            folderUris.push(uri);
        } else {
            fileUris.push(uri);
        }
    }

    const title: string = getUploadingMessage(treeItem.label);
    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (notificationProgress, cancellationToken) => {
        for (const folderUri of folderUris) {
            throwIfCanceled(cancellationToken, actionContext.telemetry.properties, 'uploadToAzureStorage');
            await uploadFolder(actionContext, treeItem, folderUri, nonNullValue(remoteResourceNameMap.get(folderUri)), notificationProgress, cancellationToken);
        }

        await uploadFiles(actionContext, treeItem, fileUris, remoteResourceNameMap, notificationProgress, cancellationToken);
    });

    const success: string = localize('successfullyUploaded', 'Successfully uploaded to "{0}"', treeItem.label);
    ext.outputChannel.appendLog(success);
    vscode.window.showInformationMessage(success);
}
