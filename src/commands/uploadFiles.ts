/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, IParsedError, parseError } from "@microsoft/vscode-azext-utils";
import { CancellationToken, ProgressLocation, Uri, window } from "vscode";
import { NotificationProgress, storageFilter } from "../constants";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { ICopyUrl } from '../tree/ICopyUrl';
import { AzExtFsExtra } from "../utils/AzExtFsExtra";
import { isAzCopyError, multipleAzCopyErrorsMessage, throwIfCanceled } from "../utils/errorUtils";
import { nonNullValue } from "../utils/nonNull";
import { checkCanUpload, convertLocalPathToRemotePath, getDestinationDirectory, getUploadingMessage, outputAndCopyUploadedFileUrls, OverwriteChoice, upload } from "../utils/uploadUtils";
import { IAzCopyResolution } from "./azCopy/IAzCopyResolution";

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
): Promise<IAzCopyResolution> {
    const calledFromUploadToAzureStorage: boolean = uris !== undefined;
    if (uris === undefined) {
        uris = await context.ui.showOpenDialog(
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

    treeItem = treeItem || await ext.rgApi.pickAppResource<BlobContainerTreeItem | FileShareTreeItem>(context, {
        filter: storageFilter,
        expectedChildContextValue: [BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue]
    });
    destinationDirectory = await getDestinationDirectory(context, destinationDirectory);
    let urisToUpload: Uri[] = [];
    const fileEndings: string[] = [];
    if (!calledFromUploadToAzureStorage) {
        const overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };
        for (const uri of uris) {
            const destPath: string = convertLocalPathToRemotePath(uri.fsPath, destinationDirectory);
            if (!await AzExtFsExtra.isDirectory(uri) && await checkCanUpload(context, destPath, overwriteChoice, treeItem)) {
                // Don't allow directories to sneak in https://github.com/microsoft/vscode-azurestorage/issues/803
                urisToUpload.push(uri);
                fileEndings.push(destPath);
            }
        }
    } else {
        urisToUpload = uris;
    }

    if (!urisToUpload.length) {
        // No URIs to upload and no errors to report
        return { errors: [] };
    }

    if (notificationProgress && cancellationToken) {
        return await uploadFilesHelper(context, treeItem, urisToUpload, notificationProgress, cancellationToken, destinationDirectory, calledFromUploadToAzureStorage);
    } else {
        const title: string = getUploadingMessage(treeItem.label);
        const resolution: IAzCopyResolution = await window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
            return await uploadFilesHelper(context, nonNullValue(treeItem), urisToUpload, newNotificationProgress, newCancellationToken, nonNullValue(destinationDirectory), calledFromUploadToAzureStorage);
        });

        if (!calledFromUploadToAzureStorage) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            outputAndCopyUploadedFileUrls((<ICopyUrl>treeItem).getUrl!(), fileEndings);
        }

        return resolution;
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
): Promise<IAzCopyResolution> {
    lastUriUpload = uris[0];
    const resolution: IAzCopyResolution = { errors: [] };
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
                resolution.errors.push(parsedError);
            } else {
                throw error;
            }
        }
    }

    if (calledFromUploadToAzureStorage || resolution.errors.length === 0) {
        // No need to throw any errors from this function
        return resolution;
    } else if (resolution.errors.length === 1) {
        throw resolution.errors[0];
    } else {
        throw new Error(multipleAzCopyErrorsMessage);
    }
}
