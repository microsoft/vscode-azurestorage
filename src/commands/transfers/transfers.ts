/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { FromToOption, ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";

import { AzExtFsExtra, IActionContext } from "@microsoft/vscode-azext-utils";
import { CancellationToken } from "vscode";
import { TransferProgress } from "../../TransferProgress";
import { NotificationProgress } from "../../constants";
import { ext } from "../../extensionVariables";
import { checkCanOverwrite } from "../../utils/checkCanOverwrite";
import { isSubpath } from "../../utils/fs";
import { localize } from "../../utils/localize";
import { OverwriteChoice } from "../../utils/uploadUtils";
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

export async function downloadFoldersAndFiles(context: IDownloadWizardContext, progress: NotificationProgress, folders: DownloadItem[], files: DownloadItem[], cancellationToken?: CancellationToken): Promise<void> {
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
        const message: string = localize('downloadingTo', 'Downloading to "{0}"...', context.destinationFolder);
        context.activityTitle = message;
        ext.outputChannel.appendLog(message);
        progress.report({ message });

        for (const item of itemsToDownload) {
            // @todo: add if/else for vscode.dev code path
            await startAzCopyDownload(context, progress, item, cancellationToken);
        }

        const downloaded: string = localize('successfullyDownloaded', 'Downloaded to "{0}".', context.destinationFolder);
        context.activityTitle = downloaded;
        progress.report({ message: downloaded });
        ext.outputChannel.appendLog(downloaded);
    }
}

export async function uploadFiles(): Promise<void> {
    // @todo
}

export async function uploadFolders(): Promise<void> {
    // @todo
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

async function startAzCopyDownload(context: IDownloadWizardContext, progress: NotificationProgress, item: DownloadItem, cancellationToken?: CancellationToken): Promise<void> {
    const { azCopyTransfer } = await import("./azCopy/azCopyTransfer");
    const { createAzCopyLocalLocation, createAzCopyRemoteLocation } = await import("./azCopy/azCopyLocations");

    const src: IRemoteSasLocation = createAzCopyRemoteLocation(item.resourceUri, item.sasToken, item.remoteFilePath, item.isDirectory);
    const dst: ILocalLocation = createAzCopyLocalLocation(item.localFilePath);
    const fromTo: FromToOption = item.type === "blob" ? "BlobLocal" : "FileLocal";
    const units: 'files' | 'bytes' = item.isDirectory ? 'files' : 'bytes';
    const transferProgress: TransferProgress = new TransferProgress(units, item.remoteFileName);
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, progress, cancellationToken);
    if (item.isDirectory) {
        await AzExtFsExtra.ensureDir(item.localFilePath);
    }
}
