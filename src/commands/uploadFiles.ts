/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, ProgressLocation, Uri, window } from "vscode";
import { IActionContext } from "vscode-azureextensionui";
import { NotificationProgress } from "../constants";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { throwIfCanceled } from "../utils/errorUtils";
import { nonNullValue } from "../utils/nonNull";
import { convertLocalPathToRemotePath, getUploadingMessage, OverwriteChoice, shouldUploadUri, upload } from "../utils/uploadUtils";

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
    cancellationToken?: CancellationToken
): Promise<void> {
    let shouldCheckUris: boolean = false;
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
        shouldCheckUris = true;
    }

    // tslint:disable-next-line: strict-boolean-expressions
    treeItem = treeItem || <BlobContainerTreeItem | FileShareTreeItem>(await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], context));
    let urisToUpload: Uri[] = [];
    if (shouldCheckUris) {
        let overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };
        for (const uri of uris) {
            if (await shouldUploadUri(treeItem, uri, overwriteChoice)) {
                urisToUpload.push(uri);
            }
        }
    } else {
        urisToUpload = uris;
    }

    if (notificationProgress && cancellationToken) {
        await uploadFilesHelper(context, treeItem, urisToUpload, notificationProgress, cancellationToken);
    } else {
        const title: string = getUploadingMessage(treeItem.label);
        await window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
            await uploadFilesHelper(context, nonNullValue(treeItem), urisToUpload, newNotificationProgress, newCancellationToken);
        });
    }
}

async function uploadFilesHelper(
    context: IActionContext,
    treeItem: BlobContainerTreeItem | FileShareTreeItem,
    uris: Uri[],
    notificationProgress: NotificationProgress,
    cancellationToken: CancellationToken
): Promise<void> {
    lastUriUpload = uris[0];
    for (const uri of uris) {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'uploadFiles');

        const localFilePath: string = uri.fsPath;
        const remoteFilePath: string = convertLocalPathToRemotePath(localFilePath);
        const id: string = `${treeItem.fullId}/${remoteFilePath}`;
        const result = await treeItem.treeDataProvider.findTreeItem(id, context);
        if (result) {
            // A treeItem for this file already exists, no need to do anything with the tree, just upload
            await treeItem.uploadLocalFile(context, localFilePath, remoteFilePath, notificationProgress, cancellationToken);
        } else {
            await treeItem.createChild(<IExistingFileContext>{ ...context, remoteFilePath, localFilePath });
        }
    }
}
