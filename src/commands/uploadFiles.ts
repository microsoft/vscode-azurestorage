/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { stat } from "fs-extra";
import { CancellationToken, ProgressLocation, Uri, window } from "vscode";
import { IActionContext, IParsedError, parseError } from "vscode-azureextensionui";
import { NotificationProgress } from "../constants";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { isAzCopyError, multipleAzCopyErrorsMessage, throwIfCanceled } from "../utils/errorUtils";
import { nonNullValue } from "../utils/nonNull";
import { convertLocalPathToRemotePath, getDestinationDirectory, getUploadingMessage, OverwriteChoice, shouldUploadUri, upload } from "../utils/uploadUtils";

let lastUriUpload: Uri | undefined;

export interface IExistingFileContext extends IActionContext {
    localFilePath: string;
    remoteFilePath: string;
}

export async function uploadFiles(
    context: IActionContext,
    treeItem?: BlobContainerTreeItem | FileShareTreeItem,
    uris?: Uri[],
    notificationProgress?: NotificationProgress,
    cancellationToken?: CancellationToken,
    destinationDirectory?: string
): Promise<IParsedError[]> {
    const calledFromUploadToAzureStorage: boolean = uris !== undefined;
    if (uris === undefined) {
        uris = await ext.ui.showOpenDialog(
            {
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                defaultUri: lastUriUpload,
                filters: {
                    "All files": ['*']
                },
                openLabel: upload
            }
        );
    }

    // tslint:disable-next-line: strict-boolean-expressions
    treeItem = treeItem || <BlobContainerTreeItem | FileShareTreeItem>(await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], context));
    destinationDirectory = await getDestinationDirectory(destinationDirectory);
    let urisToUpload: Uri[] = [];
    if (!calledFromUploadToAzureStorage) {
        let overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };
        for (const uri of uris) {
            if (!(await stat(uri.fsPath)).isDirectory() && await shouldUploadUri(treeItem, uri, overwriteChoice, destinationDirectory)) {
                // Don't allow directories to sneak in https://github.com/microsoft/vscode-azurestorage/issues/803
                urisToUpload.push(uri);
            }
        }
    } else {
        urisToUpload = uris;
    }

    if (!urisToUpload.length) {
        // No URIs to upload and no errors to report
        return [];
    }

    if (notificationProgress && cancellationToken) {
        return await uploadFilesHelper(context, treeItem, urisToUpload, notificationProgress, cancellationToken, destinationDirectory, calledFromUploadToAzureStorage);
    } else {
        const title: string = getUploadingMessage(treeItem.label);
        return await window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
            return await uploadFilesHelper(context, nonNullValue(treeItem), urisToUpload, newNotificationProgress, newCancellationToken, nonNullValue(destinationDirectory), calledFromUploadToAzureStorage);
        });
    }
}

async function uploadFilesHelper(
    context: IActionContext,
    treeItem: BlobContainerTreeItem | FileShareTreeItem,
    uris: Uri[],
    notificationProgress: NotificationProgress,
    cancellationToken: CancellationToken,
    destinationDirectory: string,
    calledFromUploadToAzureStorage: boolean
): Promise<IParsedError[]> {
    lastUriUpload = uris[0];
    const errors: IParsedError[] = [];
    for (const uri of uris) {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'uploadFiles');

        const localFilePath: string = uri.fsPath;
        const remoteFilePath: string = convertLocalPathToRemotePath(localFilePath, destinationDirectory);
        const id: string = `${treeItem.fullId}/${remoteFilePath}`;
        const result = await treeItem.treeDataProvider.findTreeItem(id, context);
        try {
            if (result) {
                // A treeItem for this file already exists, no need to do anything with the tree, just upload
                await treeItem.uploadLocalFile(context, localFilePath, remoteFilePath, notificationProgress, cancellationToken);
            } else {
                await treeItem.createChild(<IExistingFileContext>{ ...context, remoteFilePath, localFilePath });
            }
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            if (isAzCopyError(parsedError)) {
                errors.push(parsedError);
            } else {
                throw error;
            }
        }
    }

    if (calledFromUploadToAzureStorage) {
        // `uploadToAzureStorage` will deal with any errors
        return errors;
    } else if (errors.length === 1) {
        throw errors[0];
    } else if (errors.length > 1) {
        throw new Error(multipleAzCopyErrorsMessage);
    } else {
        // No errors
        return [];
    }
}
