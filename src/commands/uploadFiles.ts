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
import { getRemoteResourceName, getUploadingMessage, OverwriteChoice, RemoteResourceNameMap, upload } from "../utils/uploadUtils";

let lastUriUpload: Uri | undefined;

export interface IExistingFileContext extends IActionContext {
    localFilePath: string;
    remoteFilePath: string;
}

export async function uploadFiles(
    context: IActionContext,
    treeItem?: BlobContainerTreeItem | FileShareTreeItem,
    uris?: Uri[],
    remoteResourceNameMap?: RemoteResourceNameMap,
    notificationProgress?: NotificationProgress,
    cancellationToken?: CancellationToken
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
    if (remoteResourceNameMap === undefined) {
        remoteResourceNameMap = new Map();
        let overwriteChoice: OverwriteChoice = { choice: undefined };
        let remoteFileName: string;
        for (const uri of uris) {
            remoteFileName = await getRemoteResourceName(treeItem, uri, overwriteChoice);
            remoteResourceNameMap.set(uri, remoteFileName);
        }
    }

    if (notificationProgress && cancellationToken) {
        await uploadFilesHelper(context, treeItem, uris, remoteResourceNameMap, notificationProgress, cancellationToken);
    } else {
        const title: string = getUploadingMessage(treeItem.label);
        await window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
            // tslint:disable-next-line: strict-boolean-expressions no-non-null-assertion
            await uploadFilesHelper(context, treeItem!, uris || [], remoteResourceNameMap!, newNotificationProgress, newCancellationToken);
        });
    }
}

async function uploadFilesHelper(
    context: IActionContext,
    treeItem: BlobContainerTreeItem | FileShareTreeItem,
    uris: Uri[],
    remoteResourceNameMap: RemoteResourceNameMap,
    notificationProgress: NotificationProgress,
    cancellationToken: CancellationToken
): Promise<void> {
    lastUriUpload = uris[0];
    for (const uri of uris) {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'uploadFiles');

        // tslint:disable-next-line:no-non-null-assertion
        const remoteFilePath: string = remoteResourceNameMap.get(uri)!;
        const localFilePath: string = uri.fsPath;
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
