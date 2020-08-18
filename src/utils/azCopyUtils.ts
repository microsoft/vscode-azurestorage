/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, IAzCopyClient, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
import { ContainerClient } from "@azure/storage-blob";
import { ShareClient } from "@azure/storage-file-share";
import { stat } from "fs-extra";
import { platform } from "os";
import { join } from "path";
import { IActionContext } from "vscode-azureextensionui";
import { getResourcesPath } from "../constants";
import { TransferProgress } from "../TransferProgress";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../tree/fileShare/FileShareTreeItem";
import { createBlobContainerClient } from "./blobUtils";
import { delay } from "./delay";
import { createShareClient } from "./fileUtils";
import { Limits } from "./limits";
import { localize } from "./localize";

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
    const exe: string = getAzCopyExePath();
    const copyClient: AzCopyClient = new AzCopyClient({ exe });
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
        await delay(1000);
    }

    return jobId;
}

function getAzCopyExePath(): string {
    const nodeModulesPath: string = join(getResourcesPath(), 'azCopy', 'node_modules', '@azure-tools');
    if (platform() === "win32") {
        return (process.arch.toLowerCase() === "x64" || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432")) ?
            join(nodeModulesPath, 'azcopy-win64', 'dist', 'bin', 'azcopy_windows_amd64.exe') :
            join(nodeModulesPath, 'azcopy-win32', 'dist', 'bin', 'azcopy_windows_amd86.exe');
    } else if (platform() === "darwin") {
        return join(nodeModulesPath, 'azcopy-darwin', 'dist', 'bin', 'azcopy_darwin_amd64');
    } else {
        return join(nodeModulesPath, 'azcopy-linux', 'dist', 'bin', 'azcopy_linux_amd64');
    }
}
