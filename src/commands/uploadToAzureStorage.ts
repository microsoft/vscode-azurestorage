/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, IActionContext, IParsedError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { storageFilter } from '../constants';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { refreshTreeItem } from '../tree/refreshTreeItem';
import { multipleAzCopyErrorsMessage, throwIfCanceled } from '../utils/errorUtils';
import { isSubpath } from '../utils/fs';
import { localize } from '../utils/localize';
import { checkCanUpload, convertLocalPathToRemotePath, getUploadingMessage, OverwriteChoice, promptForDestinationDirectory, showUploadSuccessMessage } from '../utils/uploadUtils';
import { uploadFiles } from './uploadFiles/uploadFiles';
import { uploadFolder } from './uploadFolder/uploadFolder';

export async function uploadToAzureStorage(context: IActionContext, _firstSelection: vscode.Uri, uris: vscode.Uri[]): Promise<void> {
    const treeItem = await ext.rgApi.pickAppResource<BlobContainerTreeItem | FileShareTreeItem>(context, {
        filter: storageFilter,
        expectedChildContextValue: [BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue]
    });
    const destinationDirectory: string = await promptForDestinationDirectory(context);
    const allFolderUris: vscode.Uri[] = [];
    const allFileUris: vscode.Uri[] = [];

    for (const uri of uris) {
        if (uri.scheme === 'azurestorage') {
            throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
        }

        if (await AzExtFsExtra.isDirectory(uri)) {
            allFolderUris.push(uri);
        } else {
            allFileUris.push(uri);
        }
    }

    let hasParent: boolean;
    const overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };
    const folderUrisToUpload: vscode.Uri[] = [];
    const fileUrisToUpload: vscode.Uri[] = [];

    // Only upload folders and files if their containing folder isn't already being uploaded.
    for (const folderUri of allFolderUris) {
        hasParent = false;
        for (const parentFolderUri of allFolderUris) {
            if (folderUri !== parentFolderUri && isSubpath(parentFolderUri.fsPath, folderUri.fsPath)) {
                hasParent = true;
                break;
            }
        }

        const destPath: string = convertLocalPathToRemotePath(folderUri.fsPath, destinationDirectory);
        if (!hasParent && await checkCanUpload(context, destPath, overwriteChoice, treeItem)) {
            folderUrisToUpload.push(folderUri);
        }
    }

    for (const fileUri of allFileUris) {
        hasParent = false;
        for (const folderUri of allFolderUris) {
            if (isSubpath(folderUri.fsPath, fileUri.fsPath)) {
                hasParent = true;
                break;
            }
        }

        const destPath: string = convertLocalPathToRemotePath(fileUri.fsPath, destinationDirectory);
        if (!hasParent && await checkCanUpload(context, destPath, overwriteChoice, treeItem)) {
            fileUrisToUpload.push(fileUri);
        }
    }

    if (!folderUrisToUpload.length && !fileUrisToUpload.length) {
        // No URIs to upload
        return;
    }

    const errors: IParsedError[] = [];
    const title: string = getUploadingMessage(treeItem.label);
    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (_notificationProgress, cancellationToken) => {
        for (const folderUri of folderUrisToUpload) {
            throwIfCanceled(cancellationToken, context.telemetry.properties, 'uploadToAzureStorage');
            errors.push(...(await uploadFolder(context, treeItem, undefined, folderUri, cancellationToken, destinationDirectory)).errors);
        }

        errors.push(...(await uploadFiles(context, treeItem, undefined, fileUrisToUpload, cancellationToken, destinationDirectory)).errors);
    });

    if (errors.length === 1) {
        throw errors[0];
    } else if (errors.length > 1) {
        throw new Error(multipleAzCopyErrorsMessage);
    } else {
        showUploadSuccessMessage(treeItem.label);
    }

    await refreshTreeItem(context, treeItem);
}
