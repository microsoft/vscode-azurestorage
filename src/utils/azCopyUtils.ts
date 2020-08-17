/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, IAzCopyClient, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
import { ContainerClient } from "@azure/storage-blob";
import { ShareClient } from "@azure/storage-file-share";
import { stat } from "fs-extra";
import { MessageItem } from "vscode";
import { callWithTelemetryAndErrorHandling, IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { TransferProgress } from "../TransferProgress";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { createBlobContainerClient } from "./blobUtils";
import { cpUtils } from "./cpUtils";
import { createShareClient } from "./fileUtils";
import { Limits } from "./limits";
import { localize } from "./localize";
import { openUrl } from "./openUrl";

const threeDaysInMS: number = 1000 * 60 * 60 * 24 * 3;

export async function shouldUseAzCopy(context: IActionContext, localPath: string): Promise<boolean> {
    const size: number = (await stat(localPath)).size;
    context.telemetry.measurements.fileTransferSize = size;
    const useAzCopy: boolean = size > Limits.maxUploadDownloadSizeBytes;
    context.telemetry.properties.azCopyTransfer = useAzCopy ? 'true' : 'false';
    return useAzCopy;
}

export function createAzCopyLocalSource(sourcePath: string): ILocalLocation {
    return { type: "Local", path: sourcePath, useWildCard: false };
}

export function createAzCopyDestination(treeItem: BlobContainerTreeItem | FileShareTreeItem, destinationPath: string): IRemoteSasLocation {
    let resourceUri: string;
    if (treeItem instanceof BlobContainerTreeItem) {
        const containerClient: ContainerClient = createBlobContainerClient(treeItem.root, treeItem.container.name);
        resourceUri = containerClient.url;
    } else {
        const shareClient: ShareClient = createShareClient(treeItem.root, treeItem.shareName);
        resourceUri = shareClient.url;
    }

    const sasToken: string = treeItem.root.generateSasToken(
        new Date(new Date().getTime() + threeDaysInMS),
        'rwl', // read, write, list
        'bf', // blob, file
        'o', // object
    );
    // Ensure path begins with '/' to transfer properly
    const path: string = destinationPath[0] === '/' ? destinationPath : `/${destinationPath}`;
    return { type: "RemoteSas", sasToken, resourceUri, path, useWildCard: false };
}

export async function azCopyBlobTransfer(
    src: ILocalLocation,
    dst: IRemoteSasLocation,
    transferProgress: TransferProgress,
): Promise<void> {
    await azCopyTransfer(src, dst, transferProgress, 'LocalBlob');
}

async function azCopyTransfer(
    src: ILocalLocation,
    dst: IRemoteSasLocation,
    transferProgress: TransferProgress,
    fromTo: FromToOption,
): Promise<void> {
    await validateAzCopyInstalled();
    const copyClient: AzCopyClient = new AzCopyClient({ exe: ext.azCopyExePath });
    const copyOptions: ICopyOptions = { fromTo, overwriteExisting: "true", recursive: true, followSymLinks: true };
    let jobId: string = await startAndWaitForCopy(copyClient, src, dst, copyOptions, transferProgress);
    let finalTransferStatus = (await copyClient.getJobInfo(jobId)).latestStatus;
    if (!finalTransferStatus || finalTransferStatus.JobStatus === 'Failed') {
        throw new Error(localize('azCopyTransferFailed', `AzCopy Transfer Failed${finalTransferStatus?.ErrorMsg ? `: ${finalTransferStatus.ErrorMsg}` : ''}`));
    }
}

async function startAndWaitForCopy(
    copyClient: IAzCopyClient,
    src: AzCopyLocation,
    dst: AzCopyLocation,
    options: ICopyOptions,
    transferProgress: TransferProgress,
): Promise<string> {
    let jobId: string = await copyClient.copy(src, dst, options);
    let status: TransferStatus | undefined;
    let finishedWork: number;
    while (!status || status.StatusType !== 'EndOfJob') {
        status = (await copyClient.getJobInfo(jobId)).latestStatus;
        // tslint:disable-next-line: strict-boolean-expressions
        finishedWork = status && (src.useWildCard ? status.TransfersCompleted : status.BytesOverWire) || 0;
        transferProgress.reportToOutputWindow(finishedWork);

        // tslint:disable-next-line: no-string-based-set-timeout
        await new Promise((resolve, _reject) => setTimeout(resolve, 1000));
    }

    return jobId;
}

async function validateAzCopyInstalled(): Promise<void> {
    await callWithTelemetryAndErrorHandling('azureStorage.validateAzCopyInstalled', async (context: IActionContext) => {
        context.errorHandling.suppressDisplay = true;
        if (!(await azCopyInstalled())) {
            const message: string = localize('azCopyRequired', 'AzCopy is required for multiple file transfers and transfers >{0}MB.', Limits.maxUploadDownloadSizeMB);
            const download: MessageItem = { title: localize('downloadAzCopy', 'Download AzCopy') };
            const input: MessageItem | undefined = await ext.ui.showWarningMessage(message, { modal: true }, download);
            context.telemetry.properties.dialogResult = input.title;
            if (input === download) {
                await openUrl('https://aka.ms/AA963mk');
                // tslint:disable-next-line: no-floating-promises
                ext.ui.showWarningMessage('Be sure to add "azcopy" to your path after downloading.');
            }
        }
        throw new UserCancelledError();
    });
}

async function azCopyInstalled(): Promise<boolean> {
    try {
        await cpUtils.executeCommand(undefined, undefined, ext.azCopyExePath, '--version');
        return true;
    } catch (error) {
        return false;
    }
}
