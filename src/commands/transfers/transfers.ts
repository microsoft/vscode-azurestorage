/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { FromToOption, ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";

import { AzExtFsExtra, IActionContext } from "@microsoft/vscode-azext-utils";
import { dirname } from "path";
import { CancellationToken } from "vscode";
import { TransferProgress } from "../../TransferProgress";
import { NotificationProgress } from "../../constants";
import { ext } from "../../extensionVariables";
import { checkCanOverwrite } from "../../utils/checkCanOverwrite";
import { isEmptyDirectory, isSubpath } from "../../utils/fs";
import { localize } from "../../utils/localize";
import { OverwriteChoice, getUploadingMessageWithSource } from "../../utils/uploadUtils";
import { IDownloadWizardContext } from "../downloadFiles/IDownloadWizardContext";

export type DownloadItem = {
    type: "blob" | "file";
    remoteFileName: string;
    remoteFilePath: string;
    localFilePath: string;
    isDirectory: boolean;
    resourceUri: string;
    sasToken: string;
}

export async function downloadFoldersAndFiles(context: IDownloadWizardContext, folders: DownloadItem[], files: DownloadItem[], notificationProgress?: NotificationProgress, cancellationToken?: CancellationToken): Promise<void> {
    const overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };

    const foldersToDownload = (await Promise.all(folders
        .filter((folder) => parentIsNotInFolderList(folder, folders))
        .map(async (folder) => (await okToOverwriteOrDoesNotExist(context, folder, overwriteChoice)) ? folder : undefined)))
        .filter((maybeFolder): maybeFolder is DownloadItem => maybeFolder !== undefined);

    const filesToDownload = (await Promise.all(files
        .filter((file) => parentIsNotInFolderList(file, folders))
        .map(async (file) => (await okToOverwriteOrDoesNotExist(context, file, overwriteChoice)) ? file : undefined)))
        .filter((maybeFile): maybeFile is DownloadItem => maybeFile !== undefined);

    const itemsToDownload = foldersToDownload.concat(filesToDownload);
    if (itemsToDownload.length > 0) {
        const inProgressMessage: string = localize('downloadingTo', 'Downloading to "{0}"...', context.destinationFolder);
        context.activityTitle = inProgressMessage;
        ext.outputChannel.appendLog(inProgressMessage);
        notificationProgress?.report({ message: inProgressMessage });

        for (const item of itemsToDownload) {
            if (!ext.isWeb) {
                // @todo: add code path for isWeb === true
                await startAzCopyDownload(context, item, notificationProgress, cancellationToken);
            }
        }

        const downloadedMessage: string = localize('successfullyDownloaded', 'Downloaded to "{0}".', context.destinationFolder);
        context.activityTitle = downloadedMessage;
        notificationProgress?.report({ message: downloadedMessage });
        ext.outputChannel.appendLog(downloadedMessage);
    }
}

export type UploadItem = {
    type: "blob" | "file";
    localFilePath: string;
    resourceName: string;
    resourceUri: string;
    remoteFilePath: string;
    transferSasToken: string;
}

export async function uploadFile(context: IActionContext, item: UploadItem, notificationProgress?: NotificationProgress, cancellationToken?: CancellationToken): Promise<void> {
    ext.outputChannel.appendLog(getUploadingMessageWithSource(item.localFilePath, item.resourceName));

    if (!ext.isWeb) {
        // @todo: add code path for isWeb === true
        await startAzCopyFileUpload(context, item, notificationProgress, cancellationToken);
    }
}

export async function uploadFolder(context: IActionContext, item: UploadItem, messagePrefix?: string, notificationProgress?: NotificationProgress, cancellationToken?: CancellationToken): Promise<void> {
    ext.outputChannel.appendLog(getUploadingMessageWithSource(item.localFilePath, item.resourceName));

    if (!ext.isWeb) {
        // @todo: add code path for isWeb === true
        await startAzCopyFolderUpload(context, item, messagePrefix, notificationProgress, cancellationToken);
    }

}

/**
 * Returns `true` if none of the items in `maybeParents` are a parent of `item`.
 * @param item The item to check. Can be a file or folder. Can be included in `maybeParents`.
 * @param folders The folders to check against. Should be all folders.
 */
function parentIsNotInFolderList(item: DownloadItem, folders: DownloadItem[]): boolean {
    return !folders.some((maybeParent) => {
        return item !== maybeParent && isSubpath(maybeParent.remoteFilePath, item.remoteFilePath);
    });
}

/**
 * Returns `true` if either `item` does not exist locally or if the user chooses to overwrite it.
 * @param context The action context.
 * @param item The item to check.
 * @param overwriteChoice The current overwrite choice. Makes use of pass-by-reference such that the value of `overwriteChoice.choice` may be updated.
 */
function okToOverwriteOrDoesNotExist(context: IActionContext, item: DownloadItem, overwriteChoice: { choice: OverwriteChoice | undefined }): Promise<boolean> {
    return checkCanOverwrite(context, item.localFilePath, overwriteChoice, async () => await AzExtFsExtra.pathExists(item.localFilePath));
}

async function startAzCopyDownload(context: IDownloadWizardContext, item: DownloadItem, progress?: NotificationProgress, cancellationToken?: CancellationToken): Promise<void> {
    // Import AzCopy packages with async import to avoid loading them in runtimes that don't support AzCopy.
    const { azCopyTransfer } = await import("./azCopy/azCopyTransfer");
    const { createAzCopyLocalLocation, createAzCopyRemoteLocation } = await import("./azCopy/azCopyLocations");

    const src: IRemoteSasLocation = createAzCopyRemoteLocation(item.resourceUri, item.sasToken, item.remoteFilePath, item.isDirectory);
    const dst: ILocalLocation = createAzCopyLocalLocation(item.localFilePath);
    const fromTo: FromToOption = item.type === "blob" ? "BlobLocal" : "FileLocal";
    const units: "files" | "bytes" = item.isDirectory ? "files" : "bytes";
    const transferProgress: TransferProgress = new TransferProgress(units, item.remoteFileName);
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, progress, cancellationToken);
    if (item.isDirectory) {
        await AzExtFsExtra.ensureDir(item.localFilePath);
    }
}

async function startAzCopyFileUpload(context: IActionContext, item: UploadItem, notificationProgress?: NotificationProgress, cancellationToken?: CancellationToken) {
    // Import AzCopy packages with async import to avoid loading them in runtimes that don't support AzCopy.
    const { azCopyTransfer } = await import("./azCopy/azCopyTransfer");
    const { createAzCopyLocalLocation, createAzCopyRemoteLocation } = await import("./azCopy/azCopyLocations");

    const src: ILocalLocation = createAzCopyLocalLocation(item.localFilePath);
    const dst: IRemoteSasLocation = createAzCopyRemoteLocation(item.resourceUri, item.transferSasToken, item.remoteFilePath);
    const transferProgress: TransferProgress = new TransferProgress("bytes", item.remoteFilePath);
    await azCopyTransfer(context, "LocalBlob", src, dst, transferProgress, notificationProgress, cancellationToken);
}

async function startAzCopyFolderUpload(context: IActionContext, item: UploadItem, messagePrefix?: string, notificationProgress?: NotificationProgress, cancellationToken?: CancellationToken): Promise<void> {
    // Import AzCopy packages with async import to avoid loading them in runtimes that don't support AzCopy.
    const { azCopyTransfer } = await import("./azCopy/azCopyTransfer");
    const { createAzCopyLocalLocation, createAzCopyRemoteLocation } = await import("./azCopy/azCopyLocations");

    let useWildCard: boolean = true;
    if (await isEmptyDirectory(item.localFilePath)) {
        useWildCard = false;
        item.remoteFilePath = dirname(item.remoteFilePath);
        if (item.remoteFilePath === ".") {
            item.remoteFilePath = "";
        }
    }
    const fromTo: FromToOption = item.type === "blob" ? "LocalBlob" : "LocalFile";

    const src: ILocalLocation = createAzCopyLocalLocation(item.localFilePath, useWildCard);
    const dst: IRemoteSasLocation = createAzCopyRemoteLocation(item.resourceUri, item.transferSasToken, item.remoteFilePath, false);
    const transferProgress: TransferProgress = new TransferProgress("files", messagePrefix || item.remoteFilePath);
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
}
