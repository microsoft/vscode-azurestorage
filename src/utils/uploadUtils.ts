/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import { basename, dirname, posix } from 'path';
import * as readdirp from 'readdirp';
import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from '../commands/azCopy/azCopyLocations';
import { azCopyTransfer } from '../commands/azCopy/azCopyTransfer';
import { NotificationProgress } from '../constants';
import { ext } from '../extensionVariables';
import { TransferProgress } from '../TransferProgress';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { doesBlobDirectoryExist, doesBlobExist } from './blobUtils';
import { checkCanOverwrite } from './checkCanOverwrite';
import { doesDirectoryExist } from './directoryUtils';
import { doesFileExist } from './fileUtils';
import { localize } from './localize';

export const upload: string = localize('upload', 'Upload');

export enum OverwriteChoice {
    yesToAll,
    yes,
    noToAll,
    no
}

export async function uploadLocalFolder(
    context: IActionContext,
    destTreeItem: BlobContainerTreeItem | FileShareTreeItem,
    sourcePath: string,
    destPath: string,
    notificationProgress: NotificationProgress,
    cancellationToken: vscode.CancellationToken,
    messagePrefix?: string,
    countFoldersAsResources?: boolean,
): Promise<void> {
    const fromTo: FromToOption = destTreeItem instanceof BlobContainerTreeItem ? 'LocalBlob' : 'LocalFile';
    const src: ILocalLocation = createAzCopyLocalLocation(sourcePath, true);
    const dst: IRemoteSasLocation = createAzCopyRemoteLocation(destTreeItem, destPath);
    const totalWork: number = await getNumResourcesInDirectory(sourcePath, countFoldersAsResources);
    const transferProgress: TransferProgress = new TransferProgress('files', totalWork, messagePrefix);
    ext.outputChannel.appendLog(getUploadingMessageWithSource(sourcePath, destTreeItem.label));
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
}

export function getUploadingMessage(treeItemLabel: string): string {
    return localize('uploadingTo', 'Uploading to "{0}"...', treeItemLabel);
}

export function getUploadingMessageWithSource(sourcePath: string, treeItemLabel: string): string {
    return localize('uploadingFromTo', 'Uploading from "{0}" to "{1}"', sourcePath, treeItemLabel);
}

export function showUploadSuccessMessage(treeItemLabel: string): void {
    const success: string = localize('uploadSuccess', 'Successfully uploaded to "{0}"', treeItemLabel);
    ext.outputChannel.appendLog(success);
    vscode.window.showInformationMessage(success);
}

export async function checkCanUpload(
    destPath: string,
    overwriteChoice: { choice: OverwriteChoice | undefined },
    treeItem: BlobContainerTreeItem | FileShareTreeItem
): Promise<boolean> {
    return await checkCanOverwrite(destPath, overwriteChoice, async () => {
        if (treeItem instanceof BlobContainerTreeItem) {
            return await doesBlobExist(treeItem, destPath) || await doesBlobDirectoryExist(treeItem, destPath);
        } else {
            return await doesFileExist(basename(destPath), treeItem, dirname(destPath), treeItem.shareName) || await doesDirectoryExist(treeItem, destPath, treeItem.shareName);
        }
    });
}

export function convertLocalPathToRemotePath(localPath: string, destinationDirectory: string): string {
    let path: string = posix.join(destinationDirectory, basename(localPath));
    if (path.startsWith(posix.sep)) {
        // `BlobClient` and `ShareFileClient` treat resource paths that start with "/" differently from those that don't. So remove the leading "/".
        // This check is done after `posix.join()` because that function removes any duplicate slashes from the beginning of the path.
        path = path.substr(1);
    }
    return path;
}

export async function promptForDestinationDirectory(): Promise<string> {
    return await ext.ui.showInputBox({
        value: posix.sep,
        prompt: localize('destinationDirectory', 'Enter the destination directory for this upload.'),
    });
}

export async function getDestinationDirectory(destinationDirectory?: string): Promise<string> {
    return destinationDirectory !== undefined ? destinationDirectory : await promptForDestinationDirectory();
}

async function getNumResourcesInDirectory(directoryPath: string, countFolders?: boolean): Promise<number> {
    const options: readdirp.ReaddirpOptions = {
        directoryFilter: ['!.git', '!.vscode'],
        type: countFolders ? 'files_directories' : 'files'
    };
    const resources: readdirp.EntryInfo[] = await readdirp.promise(directoryPath, options);
    return resources.length;
}
