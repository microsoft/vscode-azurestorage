/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { join } from "path";
import { ProgressLocation, window } from "vscode";
import { configurationSettingsKeys } from "../constants";
import { ext } from "../extensionVariables";
import { TransferProgress } from "../TransferProgress";
import { BlobDirectoryTreeItem } from "../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../tree/blob/BlobTreeItem";
import { DirectoryTreeItem } from "../tree/fileShare/DirectoryTreeItem";
import { FileTreeItem } from "../tree/fileShare/FileTreeItem";
import { IDownloadableTreeItem } from "../tree/IDownloadableTreeItem";
import { AzExtFsExtra } from "../utils/AzExtFsExtra";
import { checkCanOverwrite } from "../utils/checkCanOverwrite";
import { isSubpath } from "../utils/fs";
import { localize } from "../utils/localize";
import { showWorkspaceFoldersQuickPick } from "../utils/quickPickUtils";
import { OverwriteChoice } from "../utils/uploadUtils";
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from "./azCopy/azCopyLocations";
import { azCopyTransfer } from "./azCopy/azCopyTransfer";

interface IAzCopyDownload {
    remoteFileName: string;
    remoteFilePath: string;
    localFilePath: string;
    fromTo: FromToOption;
    isDirectory: boolean;
    treeItem: BlobTreeItem | BlobDirectoryTreeItem | FileTreeItem | DirectoryTreeItem;
}

export async function download(context: IActionContext, treeItem: IDownloadableTreeItem, treeItems?: IDownloadableTreeItem[]): Promise<void> {
    treeItems = treeItems || [treeItem];

    const placeHolderString: string = localize('selectFolderForDownload', 'Select destination folder for download');
    const destinationFolder: string = await showWorkspaceFoldersQuickPick(placeHolderString, context, configurationSettingsKeys.deployPath);

    const azCopyDownloads: IAzCopyDownload[] = await getAzCopyDownloads(context, destinationFolder, treeItems);
    if (azCopyDownloads.length === 0) {
        // Nothing to download
        return;
    }

    const title: string = localize('downloadingTo', 'Downloading to "{0}"...', destinationFolder);
    ext.outputChannel.appendLog(title);
    await window.withProgress({ title, location: ProgressLocation.Notification }, async (notificationProgress, cancellationToken) => {
        for (const azCopyDownload of azCopyDownloads) {
            const src: IRemoteSasLocation = createAzCopyRemoteLocation(azCopyDownload.treeItem, azCopyDownload.remoteFilePath, azCopyDownload.isDirectory);
            const dst: ILocalLocation = createAzCopyLocalLocation(azCopyDownload.localFilePath);
            const units: 'files' | 'bytes' = azCopyDownload.isDirectory ? 'files' : 'bytes';
            const transferProgress: TransferProgress = new TransferProgress(units, azCopyDownload.remoteFileName);
            await azCopyTransfer(context, azCopyDownload.fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
        }
    });

    ext.outputChannel.appendLog(localize('successfullyDownloaded', 'Successfully downloaded to "{0}".', destinationFolder));
}

async function getAzCopyDownloads(context: IActionContext, destinationFolder: string, treeItems: IDownloadableTreeItem[]): Promise<IAzCopyDownload[]> {
    const allFolderDownloads: IAzCopyDownload[] = [];
    const allFileDownloads: IAzCopyDownload[] = [];

    for (const treeItem of treeItems) {
        const remoteFilePath = treeItem.remoteFilePath;
        if (treeItem instanceof BlobTreeItem) {
            await treeItem.checkCanDownload(context);
            allFileDownloads.push({
                remoteFileName: treeItem.blobName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.blobName),
                fromTo: 'BlobLocal',
                isDirectory: false,
                treeItem,
            });
        } else if (treeItem instanceof BlobDirectoryTreeItem) {
            allFolderDownloads.push({
                remoteFileName: treeItem.dirName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.dirName),
                fromTo: 'BlobLocal',
                isDirectory: true,
                treeItem
            });
        } else if (treeItem instanceof FileTreeItem) {
            allFileDownloads.push({
                remoteFileName: treeItem.fileName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.fileName),
                fromTo: 'FileLocal',
                isDirectory: false,
                treeItem,
            });
        } else if (treeItem instanceof DirectoryTreeItem) {
            allFolderDownloads.push({
                remoteFileName: treeItem.directoryName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.directoryName),
                fromTo: 'FileLocal',
                isDirectory: true,
                treeItem
            });
        }
    }

    let hasParent: boolean;
    const overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };
    const foldersToDownload: IAzCopyDownload[] = [];
    const filesToDownload: IAzCopyDownload[] = [];

    // Only download folders and files if their containing folder isn't already being downloaded.
    for (const folderDownload of allFolderDownloads) {
        hasParent = false;
        for (const parentFolderDownload of allFolderDownloads) {
            if (folderDownload !== parentFolderDownload && isSubpath(parentFolderDownload.remoteFilePath, folderDownload.remoteFilePath)) {
                hasParent = true;
                break;
            }
        }

        if (!hasParent && await checkCanDownload(context, folderDownload.localFilePath, overwriteChoice)) {
            foldersToDownload.push(folderDownload);
        }
    }

    for (const fileDownload of allFileDownloads) {
        hasParent = false;
        for (const parentFolderDownload of allFolderDownloads) {
            if (isSubpath(parentFolderDownload.remoteFilePath, fileDownload.remoteFilePath)) {
                hasParent = true;
                break;
            }
        }

        if (!hasParent && await checkCanDownload(context, fileDownload.localFilePath, overwriteChoice)) {
            filesToDownload.push(fileDownload);
        }
    }

    return [...foldersToDownload, ...filesToDownload];
}

async function checkCanDownload(context: IActionContext, destPath: string, overwriteChoice: { choice: OverwriteChoice | undefined }): Promise<boolean> {
    return await checkCanOverwrite(context, destPath, overwriteChoice, async () => await AzExtFsExtra.pathExists(destPath));
}
