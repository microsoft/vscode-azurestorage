/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import { basename } from 'path';
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
import { doesBlobDirectoryExist, doesBlobExist, getBlobPath } from './blobUtils';
import { doesDirectoryExist } from './directoryUtils';
import { doesFileExist, getFileName } from './fileUtils';
import { localize } from './localize';

export const upload: string = localize('upload', 'Upload');

/**
 * Tracks whether or not to overwrite resources while uploading.
 *
 * Stored as an object to make use of pass by reference.
 */
export type OverwriteChoice = { choice: 'Yes to all' | 'Yes' | 'No to all' | 'No' | undefined };

/**
 * Map of local URI to that resource's path in Azure.
 */
export type RemoteResourceNameMap = Map<vscode.Uri, string>;

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
    const transferProgress: TransferProgress = new TransferProgress(totalWork, messagePrefix);
    ext.outputChannel.appendLog(getUploadingMessageWithSource(sourcePath, destTreeItem.label));
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
}

export function getUploadingMessage(treeItemLabel: string): string {
    return localize('uploadingTo', 'Uploading to "{0}"', treeItemLabel);
}

export function getUploadingMessageWithSource(sourcePath: string, treeItemLabel: string): string {
    return localize('uploadingFromTo', 'Uploading from "{0}" to "{1}"', sourcePath, treeItemLabel);
}

export async function showUploadWarning(treeItem: BlobContainerTreeItem | FileShareTreeItem, resourcePath: string): Promise<OverwriteChoice> {
    let shouldWarn: boolean;
    if (treeItem instanceof BlobContainerTreeItem) {
        shouldWarn = await doesBlobExist(treeItem, resourcePath) || await doesBlobDirectoryExist(treeItem, resourcePath);
    } else {
        shouldWarn = await doesFileExist(resourcePath, treeItem, '', treeItem.shareName) || await doesDirectoryExist(treeItem, resourcePath, treeItem.shareName);
    }

    if (shouldWarn) {
        const message: string = localize('resourceExists', 'A resource named "{0}" already exists. Do you want to overwrite it?', resourcePath);
        const items = [
            { title: 'Yes to all' },
            { title: 'Yes' },
            { title: 'No to all' },
            { title: 'No' }
        ];
        return <OverwriteChoice>{ choice: (await ext.ui.showWarningMessage(message, { modal: true }, ...items)).title };
    } else {
        // This resource doesn't exist so "overwriting" is OK
        return { choice: 'Yes' };
    }
}

export async function getRemoteResourceName(treeItem: BlobContainerTreeItem | FileShareTreeItem, uri: vscode.Uri, overwriteChoice: OverwriteChoice): Promise<string> {
    const localResourcePath: string = uri.fsPath;
    const remoteResourceName: string = basename(localResourcePath);
    if (overwriteChoice.choice !== 'Yes to all' && overwriteChoice.choice !== 'No to all') {
        // Only prompt if the overwrite choice could change
        overwriteChoice.choice = (await showUploadWarning(treeItem, remoteResourceName)).choice;
    }

    switch (overwriteChoice.choice) {
        case 'No':
        case 'No to all':
            // Prompt for a new remote resource name instead of overwriting
            return treeItem instanceof BlobContainerTreeItem ?
                await getBlobPath(treeItem, remoteResourceName) :
                await getFileName(treeItem, '', treeItem.shareName, remoteResourceName);

        case 'Yes':
        case 'Yes to all':
        default:
            // Use the default remote resource name
            return remoteResourceName;
    }
}

async function getNumResourcesInDirectory(directoryPath: string, countFolders?: boolean): Promise<number> {
    const options: readdirp.ReaddirpOptions = {
        directoryFilter: ['!.git', '!.vscode'],
        type: countFolders ? 'files_directories' : 'files'
    };
    const resources: readdirp.EntryInfo[] = await readdirp.promise(directoryPath, options);
    return resources.length;
}
