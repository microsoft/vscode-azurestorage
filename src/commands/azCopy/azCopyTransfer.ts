/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, IAzCopyClient, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
import { platform } from "os";
import { join } from "path";
import { getResourcesPath } from "../../constants";
import { ext } from '../../extensionVariables';
import { TransferProgress } from "../../TransferProgress";
import { delay } from "../../utils/delay";
import { localize } from "../../utils/localize";

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
    if (!finalTransferStatus || finalTransferStatus.JobStatus !== 'Completed') {
        // tslint:disable-next-line: strict-boolean-expressions
        let message: string = localize('azCopyTransfer', `AzCopy Transfer: "${finalTransferStatus?.JobStatus || 'Failed'}".`);
        message += finalTransferStatus?.ErrorMsg ? ` ${finalTransferStatus.ErrorMsg}` : '';

        if (finalTransferStatus?.JobStatus === 'CompletedWithSkipped') {
            // tslint:disable-next-line: no-floating-promises
            ext.ui.showWarningMessage(message);
        } else {
            throw new Error(message);
        }
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
