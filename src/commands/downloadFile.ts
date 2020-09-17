/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { BlockBlobClient } from "@azure/storage-blob";
import { ShareFileClient } from "@azure/storage-file-share";
import { extname, join } from "path";
import { ProgressLocation, SaveDialogOptions, Uri, window } from "vscode";
import { IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { TransferProgress } from "../TransferProgress";
import { BlobDirectoryTreeItem } from "../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../tree/blob/BlobTreeItem";
import { DirectoryTreeItem } from "../tree/fileShare/DirectoryTreeItem";
import { FileTreeItem } from "../tree/fileShare/FileTreeItem";
import { createBlockBlobClient } from "../utils/blobUtils";
import { createFileClient } from "../utils/fileUtils";
import { localize } from "../utils/localize";
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from "./azCopy/azCopyLocations";
import { azCopyTransfer } from "./azCopy/azCopyTransfer";

export async function download(
    context: IActionContext,
    treeItem: BlobTreeItem | BlobDirectoryTreeItem | FileTreeItem | DirectoryTreeItem,
): Promise<void> {
    let remoteFileName: string;
    let remoteFilePath: string;
    let fromTo: FromToOption;
    let storageClient: BlockBlobClient | ShareFileClient | undefined;
    let isDirectory: boolean;
    if (treeItem instanceof BlobTreeItem) {
        await treeItem.checkCanDownload(context);

        remoteFileName = treeItem.blobName;
        remoteFilePath = treeItem.blobPath;
        fromTo = 'BlobLocal';
        storageClient = createBlockBlobClient(treeItem.root, treeItem.container.name, treeItem.blobPath);
        isDirectory = false;
    } else if (treeItem instanceof BlobDirectoryTreeItem) {
        remoteFileName = treeItem.dirName;
        remoteFilePath = treeItem.dirPath;
        fromTo = 'BlobLocal';
        isDirectory = true;
    } else if (treeItem instanceof FileTreeItem) {
        remoteFileName = treeItem.fileName;
        remoteFilePath = join(treeItem.directoryPath, treeItem.fileName);
        fromTo = 'FileLocal';
        storageClient = createFileClient(treeItem.root, treeItem.shareName, treeItem.directoryPath, treeItem.fileName);
        isDirectory = false;
    } else {
        remoteFileName = treeItem.directoryName;
        remoteFilePath = join(treeItem.parentPath, treeItem.directoryName);
        fromTo = 'FileLocal';
        isDirectory = true;
    }

    const uri: Uri = await getUriForDownload(remoteFileName);
    if (uri.scheme === 'file') {
        const src: IRemoteSasLocation = createAzCopyRemoteLocation(treeItem, remoteFilePath, isDirectory);
        const dst: ILocalLocation = createAzCopyLocalLocation(uri.fsPath);

        let totalWork: number | undefined;
        if (storageClient) {
            totalWork = (await storageClient.getProperties()).contentLength;
        }

        const transferProgress: TransferProgress = new TransferProgress('bytes', totalWork, remoteFileName);
        const title: string = localize('downloadingTo', 'Downloading from "{0}" to "{1}"...', remoteFileName, uri.fsPath);

        ext.outputChannel.appendLog(title);
        await window.withProgress({ title, location: ProgressLocation.Notification }, async (notificationProgress, cancellationToken) => {
            await azCopyTransfer(context, fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
        });
        ext.outputChannel.appendLog(localize('successfullyDownloaded', 'Successfully downloaded "{0}".', uri.toString()));
    } else {
        context.errorHandling.suppressReportIssue = true;
        throw new Error(localize('downloadDest', 'Download destination scheme cannot be "{0}". Only "file" scheme is supported.', uri.scheme));
    }
}

async function getUriForDownload(resourceName: string): Promise<Uri> {
    const extension: string = extname(resourceName);
    const filters = { "All files": ['*'] };
    if (extension) {
        // This is needed to ensure the file extension is added in the Save dialog, since the filename will be displayed without it by default on Windows
        filters[`*${extension}`] = [extension];
    }
    const options: SaveDialogOptions = {
        saveLabel: localize('download', 'Download'),
        filters,
        defaultUri: Uri.file(resourceName)
    };
    const uri: Uri | undefined = await window.showSaveDialog(options);
    if (uri) {
        return uri;
    } else {
        throw new UserCancelledError();
    }
}
