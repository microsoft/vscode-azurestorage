/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteSasLocation } from '@azure-tools/azcopy-node';
import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { createAzCopyDestination, createAzCopyLocalDirectorySource } from '../commands/azCopy/azCopyLocations';
import { azCopyTransfer, AzCopyTransferType } from '../commands/azCopy/azCopyTransfer';
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
    transferProgress: TransferProgress,
    notificationProgress: vscode.Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>,
    cancellationToken: vscode.CancellationToken
): Promise<void> {
    const src: ILocalLocation = createAzCopyLocalDirectorySource(sourceFolder);
    const dst: IRemoteSasLocation = createAzCopyDestination(destTreeItem, destFolder);
    let transferType: AzCopyTransferType;
    if (destTreeItem instanceof BlobContainerTreeItem) {
        transferType = 'LocalBlob';
    } else {
        transferType = 'LocalFile';
    }
    await azCopyTransfer(context, transferType, src, dst, transferProgress, notificationProgress, cancellationToken);
    ext.outputChannel.appendLog(localize('finishedUpload', 'Uploaded to "{0}".', destTreeItem.label));
}

export async function warnFileAlreadyExists(filePath: string): Promise<void> {
    await ext.ui.showWarningMessage(
        localize('fileAlreadyExists', `A file with the name "${filePath}" already exists.`),
        { modal: true },
        { title: localize('overwrite', 'Overwrite') }
    );
}
