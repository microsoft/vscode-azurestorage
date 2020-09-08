/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from "path";
import { CancellationToken, ProgressLocation, Uri, window } from "vscode";
import { IActionContext } from "vscode-azureextensionui";
import { NotificationProgress } from "../constants";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { getBlobPath } from "../utils/blobUtils";
import { throwIfCanceled } from "../utils/errorUtils";
import { getFileName } from "../utils/fileUtils";
import { getUploadingMessage, upload } from "../utils/uploadUtils";

let lastUriUpload: Uri;

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
    suppressPrompts?: boolean
): Promise<void> {
    // tslint:disable: strict-boolean-expressions
    uris = uris || await ext.ui.showOpenDialog(
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

    treeItem = treeItem || <BlobContainerTreeItem | FileShareTreeItem>(await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], context));
    // tslint:enable: strict-boolean-expressions

    if (notificationProgress && cancellationToken) {
        await uploadFilesHelper(context, treeItem, uris, notificationProgress, cancellationToken, !!suppressPrompts);
    } else {
        const title: string = getUploadingMessage(treeItem.label);
        await window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
            // tslint:disable-next-line: strict-boolean-expressions no-non-null-assertion
            await uploadFilesHelper(context, treeItem!, uris || [], newNotificationProgress, newCancellationToken, !!suppressPrompts);
        });
    }
}

async function uploadFilesHelper(
    context: IActionContext,
    treeItem: BlobContainerTreeItem | FileShareTreeItem,
    uris: Uri[],
    notificationProgress: NotificationProgress,
    cancellationToken: CancellationToken,
    suppressPrompts: boolean
): Promise<void> {
    if (uris.length) {
        lastUriUpload = uris[0];
        for (const uri of uris) {
            throwIfCanceled(cancellationToken, context.telemetry.properties, 'uploadFiles');

            const localFilePath: string = uri.fsPath;
            let remoteFilePath: string = basename(localFilePath);

            if (!suppressPrompts) {
                remoteFilePath = treeItem instanceof BlobContainerTreeItem ?
                    await getBlobPath(treeItem, remoteFilePath) :
                    await getFileName(treeItem, '', treeItem.shareName, remoteFilePath);
            }

            if (remoteFilePath) {
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
    }
}
