/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption, ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import * as readdirp from 'readdirp';
import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { createAzCopyDestination, createAzCopyLocalSource } from '../commands/azCopy/azCopyLocations';
import { azCopyTransfer } from '../commands/azCopy/azCopyTransfer';
import { ext } from '../extensionVariables';
import { TransferProgress } from '../TransferProgress';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { localize } from './localize';

export async function uploadFiles(
    context: IActionContext,
    destTreeItem: BlobContainerTreeItem | FileShareTreeItem,
    sourceFolder: string,
    destFolder: string,
    notificationProgress: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>,
    cancellationToken: vscode.CancellationToken,
    messagePrefix?: string,
    countFoldersAsResources?: boolean,
): Promise<void> {
    const src: ILocalLocation = createAzCopyLocalSource(sourceFolder, true);
    const dst: IRemoteSasLocation = createAzCopyDestination(destTreeItem, destFolder);
    let fromTo: FromToOption;
    if (destTreeItem instanceof BlobContainerTreeItem) {
        fromTo = 'LocalBlob';
    } else {
        fromTo = 'LocalFile';
    }
    const totalWork: number = await getNumResourcesInDirectory(sourceFolder, countFoldersAsResources);
    const transferProgress: TransferProgress = new TransferProgress(totalWork, messagePrefix);
    await azCopyTransfer(context, fromTo, src, dst, transferProgress, notificationProgress, cancellationToken);
    ext.outputChannel.appendLog(localize('finishedUpload', 'Uploaded to "{0}".', destTreeItem.label));
}

export async function warnFileAlreadyExists(filePath: string): Promise<void> {
    await ext.ui.showWarningMessage(
        localize('fileAlreadyExists', `A file with the name "${filePath}" already exists.`),
        { modal: true },
        { title: localize('overwrite', 'Overwrite') }
    );
}

async function getNumResourcesInDirectory(directoryPath: string, countFolders?: boolean): Promise<number> {
    const options: readdirp.ReaddirpOptions = {
        directoryFilter: ['!.git', '!.vscode'],
        type: countFolders ? 'files_directories' : 'files'
    };
    const resources: readdirp.EntryInfo[] = await readdirp.promise(directoryPath, options);
    return resources.length;
}
