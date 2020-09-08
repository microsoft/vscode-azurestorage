/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import { basename, dirname } from 'path';
import * as readdirp from 'readdirp';
import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from '../commands/azCopy/azCopyLocations';
import { azCopyTransfer } from '../commands/azCopy/azCopyTransfer';
import { ext } from '../extensionVariables';
import { TransferProgress } from '../TransferProgress';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { getBlobPath } from './blobUtils';
import { getFileName } from './fileUtils';
import { localize } from './localize';

export async function uploadFiles(
    context: IActionContext,
    destTreeItem: BlobContainerTreeItem | FileShareTreeItem,
    sourcePath: string,
    destPath: string | undefined,
    notificationProgress: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>,
    cancellationToken: vscode.CancellationToken,
    messagePrefix?: string,
    countFoldersAsResources?: boolean,
    suppressPrompts?: boolean
): Promise<void> {
    if (destPath === undefined) {
        const fileName: string = basename(sourcePath);

        if (suppressPrompts) {
            destPath = fileName;
        } else if (destTreeItem instanceof BlobContainerTreeItem) {
            destPath = await getBlobPath(destTreeItem, fileName);
        } else {
            destPath = await getFileName(destTreeItem, dirname(sourcePath), destTreeItem.shareName, fileName);
        }
    }

    const fromTo: FromToOption = destTreeItem instanceof BlobContainerTreeItem ? 'LocalBlob' : 'LocalFile';
    const src: ILocalLocation = createAzCopyLocalLocation(sourcePath, true);
    const dst: IRemoteSasLocation = createAzCopyRemoteLocation(destTreeItem, destPath);
    const totalWork: number = await getNumResourcesInDirectory(sourcePath, countFoldersAsResources);
    const transferProgress: TransferProgress = new TransferProgress(totalWork, messagePrefix);
    ext.outputChannel.appendLog(getUploadingMessage(sourcePath, destTreeItem.label));
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
}

export async function warnFileAlreadyExists(filePath: string): Promise<void> {
    await ext.ui.showWarningMessage(
        localize('fileAlreadyExists', `A file with the name "${filePath}" already exists.`),
        { modal: true },
        { title: localize('overwrite', 'Overwrite') }
    );
}

export function getUploadingMessage(sourcePath: string, treeItemLabel: string): string {
    return localize('uploading', 'Uploading "{0}" to "{1}"', sourcePath, treeItemLabel);
}

async function getNumResourcesInDirectory(directoryPath: string, countFolders?: boolean): Promise<number> {
    const options: readdirp.ReaddirpOptions = {
        directoryFilter: ['!.git', '!.vscode'],
        type: countFolders ? 'files_directories' : 'files'
    };
    const resources: readdirp.EntryInfo[] = await readdirp.promise(directoryPath, options);
    return resources.length;
}
