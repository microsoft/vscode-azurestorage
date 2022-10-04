/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, IParsedError, parseError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { NotificationProgress, storageFilter } from '../constants';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { refreshTreeItem } from '../tree/refreshTreeItem';
import { isAzCopyError } from '../utils/errorUtils';
import { nonNullValue } from '../utils/nonNull';
import { checkCanUpload, convertLocalPathToRemotePath, getDestinationDirectory, getUploadingMessageWithSource, showUploadSuccessMessage, upload, uploadLocalFolder } from '../utils/uploadUtils';
import { IAzCopyResolution } from './azCopy/IAzCopyResolution';

export async function uploadFolder(
    context: IActionContext,
    treeItem?: BlobContainerTreeItem | FileShareTreeItem,
    uri?: vscode.Uri,
    notificationProgress?: NotificationProgress,
    cancellationToken?: vscode.CancellationToken,
    destinationDirectory?: string
): Promise<IAzCopyResolution> {
    const calledFromUploadToAzureStorage: boolean = uri !== undefined;
    if (uri === undefined) {
        uri = (await context.ui.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
            openLabel: upload
        }))[0];
    }

    treeItem = treeItem || await ext.rgApi.pickAppResource<BlobContainerTreeItem | FileShareTreeItem>(context, {
        filter: storageFilter,
        expectedChildContextValue: [BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue]
    });
    destinationDirectory = await getDestinationDirectory(context, destinationDirectory);

    const sourcePath: string = uri.fsPath;
    const destPath: string = convertLocalPathToRemotePath(sourcePath, destinationDirectory);
    const resolution: IAzCopyResolution = { errors: [] };
    if (!calledFromUploadToAzureStorage && !(await checkCanUpload(context, destPath, { choice: undefined }, treeItem))) {
        // Don't upload this folder
        return resolution;
    }

    try {
        if (notificationProgress && cancellationToken) {
            await uploadLocalFolder(context, treeItem, sourcePath, destPath, notificationProgress, cancellationToken, destPath);
        } else {
            const title: string = getUploadingMessageWithSource(sourcePath, treeItem.label);
            await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
                await uploadLocalFolder(context, nonNullValue(treeItem), sourcePath, nonNullValue(destPath), newNotificationProgress, newCancellationToken, destPath);
            });
        }
    } catch (error) {
        const parsedError: IParsedError = parseError(error);
        if (calledFromUploadToAzureStorage && isAzCopyError(parsedError)) {
            // `uploadToAzureStorage` will deal with this error
            resolution.errors.push(parsedError);
        } else {
            throw error;
        }
    }

    if (!calledFromUploadToAzureStorage) {
        showUploadSuccessMessage(treeItem.label);
    }

    throw new Error('TODO: Implement  me!');
    await refreshTreeItem(undefined);
    return resolution;
}
