/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { AzExtFsExtra, AzureWizard, IActionContext, nonNullProp } from "@microsoft/vscode-azext-utils";
import { basename, join, posix } from "path";
import { ProgressLocation, window } from "vscode";
import { configurationSettingsKeys } from "../constants";
import { ext } from "../extensionVariables";
import { TransferProgress } from "../TransferProgress";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { BlobDirectoryTreeItem } from "../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../tree/blob/BlobTreeItem";
import { DirectoryTreeItem } from "../tree/fileShare/DirectoryTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { FileTreeItem } from "../tree/fileShare/FileTreeItem";
import { IDownloadableTreeItem } from "../tree/IDownloadableTreeItem";
import { checkCanOverwrite } from "../utils/checkCanOverwrite";
import { isSubpath } from "../utils/fs";
import { localize } from "../utils/localize";
import { showWorkspaceFoldersQuickPick } from "../utils/quickPickUtils";
import { OverwriteChoice } from "../utils/uploadUtils";
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from "./azCopy/azCopyLocations";
import { azCopyTransfer } from "./azCopy/azCopyTransfer";
import { getResourceUri } from "./downloadFiles/getResourceUri";
import { getSasToken } from "./downloadFiles/getSasToken";
import { ISasDownloadContext } from "./downloadFiles/ISasDownloadContext";
import { SasUrlPromptStep } from "./downloadFiles/SasUrlPromptStep";

interface IAzCopyDownload {
    remoteFileName: string;
    remoteFilePath: string;
    localFilePath: string;
    fromTo: FromToOption;
    isDirectory: boolean;
    resourceUri: string;
    sasToken: string;
}

export async function download(context: IActionContext, targets: IDownloadableTreeItem[] | string): Promise<void> {
    const placeHolderString: string = localize('selectFolderForDownload', 'Select destination folder for download');
    const destinationFolder: string = await showWorkspaceFoldersQuickPick(placeHolderString, context, configurationSettingsKeys.deployPath);

    const { allFolderDownloads, allFileDownloads } = typeof targets === 'string' ?
        await getDownloadFromSasUrl(targets, destinationFolder) :
        await getAzCopyDownloads(context, destinationFolder, targets)

    const azCopyDownloads: IAzCopyDownload[] = await checkForDuplicates(context, allFolderDownloads, allFileDownloads);

    if (azCopyDownloads.length === 0) {
        // Nothing to download
        return;
    }

    const title: string = localize('downloadingTo', 'Downloading to "{0}"...', destinationFolder);
    ext.outputChannel.appendLog(title);
    await window.withProgress({ title, location: ProgressLocation.Notification }, async (notificationProgress, cancellationToken) => {
        for (const azCopyDownload of azCopyDownloads) {
            const src: IRemoteSasLocation = createAzCopyRemoteLocation(azCopyDownload.resourceUri, azCopyDownload.sasToken, azCopyDownload.remoteFilePath, azCopyDownload.isDirectory);
            const dst: ILocalLocation = createAzCopyLocalLocation(azCopyDownload.localFilePath);
            const units: 'files' | 'bytes' = azCopyDownload.isDirectory ? 'files' : 'bytes';
            const transferProgress: TransferProgress = new TransferProgress(units, azCopyDownload.remoteFileName);
            await azCopyTransfer(context, azCopyDownload.fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
        }
    });

    ext.outputChannel.appendLog(localize('successfullyDownloaded', 'Successfully downloaded to "{0}".', destinationFolder));
}

export async function downloadSasUrl(context: ISasDownloadContext): Promise<void> {
    const wizard: AzureWizard<ISasDownloadContext> = new AzureWizard(context, {
        promptSteps: [new SasUrlPromptStep()],
        executeSteps: []
    });

    await wizard.prompt();
    return await download(context, nonNullProp(context, 'sasUrl'));
}
export async function downloadTreeItems(context: IActionContext, treeItem: IDownloadableTreeItem, treeItems?: IDownloadableTreeItem[]): Promise<void> {
    treeItems ??= [treeItem];
    await download(context, treeItems);
}

async function getAzCopyDownloads(context: IActionContext, destinationFolder: string, treeItems: IDownloadableTreeItem[]):
    Promise<{ allFolderDownloads: IAzCopyDownload[], allFileDownloads: IAzCopyDownload[] }> {
    const allFolderDownloads: IAzCopyDownload[] = [];
    const allFileDownloads: IAzCopyDownload[] = [];

    for (const treeItem of treeItems) {
        // if there is no remoteFilePath, then it is the root
        const remoteFilePath = treeItem.remoteFilePath ?? `${posix.sep}`;
        const resourceUri: string = getResourceUri(treeItem);
        const sasToken: string = getSasToken(treeItem.root);
        if (treeItem instanceof BlobTreeItem) {
            await treeItem.checkCanDownload(context);
            allFileDownloads.push({
                remoteFileName: treeItem.blobName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.blobName),
                fromTo: 'BlobLocal',
                isDirectory: false,
                resourceUri,
                sasToken
            });
        } else if (treeItem instanceof BlobDirectoryTreeItem) {
            allFolderDownloads.push({
                remoteFileName: treeItem.dirName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.dirName),
                fromTo: 'BlobLocal',
                isDirectory: true,
                resourceUri,
                sasToken
            });
        } else if (treeItem instanceof BlobContainerTreeItem) {
            allFolderDownloads.push({
                remoteFileName: treeItem.container.name,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.container.name),
                fromTo: 'BlobLocal',
                isDirectory: true,
                resourceUri,
                sasToken
            });
        } else if (treeItem instanceof FileTreeItem) {
            allFileDownloads.push({
                remoteFileName: treeItem.fileName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.fileName),
                fromTo: 'FileLocal',
                isDirectory: false,
                resourceUri,
                sasToken,
            });
        } else if (treeItem instanceof DirectoryTreeItem) {
            allFolderDownloads.push({
                remoteFileName: treeItem.directoryName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.directoryName),
                fromTo: 'FileLocal',
                isDirectory: true,
                resourceUri,
                sasToken
            });
        } else if (treeItem instanceof FileShareTreeItem) {
            allFolderDownloads.push({
                remoteFileName: treeItem.shareName,
                remoteFilePath,
                localFilePath: join(destinationFolder, treeItem.shareName),
                fromTo: 'FileLocal',
                isDirectory: true,
                resourceUri,
                sasToken
            });
        }
    }

    return { allFolderDownloads, allFileDownloads };
}

async function checkForDuplicates(context: IActionContext, allFolderDownloads: IAzCopyDownload[], allFileDownloads: IAzCopyDownload[]): Promise<IAzCopyDownload[]> {
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

async function getDownloadFromSasUrl(sasUrl: string, destinationFolder: string):
    Promise<{ allFolderDownloads: IAzCopyDownload[], allFileDownloads: IAzCopyDownload[] }> {
    const allFolderDownloads: IAzCopyDownload[] = [];
    const allFileDownloads: IAzCopyDownload[] = [];

    const url = new URL(sasUrl);
    const pathArgs = url.pathname.split('/');
    pathArgs.shift();
    const resourceName = pathArgs.shift();

    const download = {
        fromTo: url.origin.includes('blob.core') ? 'BlobLocal' : 'FileLocal' as FromToOption,
        isDirectory: pathArgs.slice(-1)[0] === '',
        remoteFileName: basename(url.pathname),
        remoteFilePath: pathArgs.join('/'),
        localFilePath: join(destinationFolder, basename(url.pathname)),
        resourceUri: `${url.origin}/${resourceName}`,
        sasToken: url.search.substring(1),
    };

    download.isDirectory ? allFolderDownloads.push(download) : allFileDownloads.push(download);

    return { allFolderDownloads, allFileDownloads };
}
