/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, IAzCopyClient, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
import { pathExists } from 'fs-extra';
import * as os from "os";
import { join } from "path";
import { callWithTelemetryAndErrorHandling, IActionContext } from "vscode-azureextensionui";
import { ext } from '../../extensionVariables';
import { TransferProgress } from "../../TransferProgress";
import { delay } from "../../utils/delay";
import { localize } from "../../utils/localize";

export async function azCopyBlobTransfer(
    src: ILocalLocation,
    dst: IRemoteSasLocation,
    transferProgress: TransferProgress,
): Promise<void> {
    await callWithTelemetryAndErrorHandling('azCopyBlobTransfer', async (context: IActionContext) => {
        context.errorHandling.rethrow = true;
        await azCopyTransfer(context, src, dst, transferProgress, 'LocalBlob');
    });
}

async function azCopyTransfer(
    context: IActionContext,
    src: ILocalLocation,
    dst: IRemoteSasLocation,
    transferProgress: TransferProgress,
    fromTo: FromToOption,
): Promise<void> {
    const exe: string = await getAzCopyExePath(os.platform());
    const copyClient: AzCopyClient = new AzCopyClient({ exe });
    const copyOptions: ICopyOptions = { fromTo, overwriteExisting: "true", recursive: true, followSymLinks: true };
    let jobId: string = await startAndWaitForCopy(copyClient, src, dst, copyOptions, transferProgress);
    let finalTransferStatus = (await copyClient.getJobInfo(jobId)).latestStatus;
    context.telemetry.properties.jobStatus = finalTransferStatus?.JobStatus;
    if (!finalTransferStatus || finalTransferStatus.JobStatus !== 'Completed') {
        // tslint:disable-next-line: strict-boolean-expressions
        let message: string = localize('azCopyTransfer', 'AzCopy Transfer: "{0}".', finalTransferStatus?.JobStatus || 'Failed');
        if (finalTransferStatus?.FailedTransfers || finalTransferStatus?.SkippedTransfers) {
            message += localize('checkOutputWindow', ' Check the output window for a list of incomplete transfers.');

            if (finalTransferStatus.FailedTransfers) {
                ext.outputChannel.appendLog(localize('failedTransfers', 'Failed transfers: {0}', finalTransferStatus.FailedTransfers.join(', ')));
            }
            if (finalTransferStatus.SkippedTransfers) {
                ext.outputChannel.appendLog(localize('skippedTransfers', 'Skipped transfers: {0}', finalTransferStatus.SkippedTransfers.join(', ')));
            }
        }
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
        finishedWork = status?.BytesOverWire || 0;
        transferProgress.reportToOutputWindow(finishedWork);
        await delay(1000);
    }

    return jobId;
}

async function getAzCopyExePath(platform: NodeJS.Platform): Promise<string> {
    let operatingSystem: 'win32' | 'win64' | 'darwin' | 'linux';
    let bitness: '64' | '86';
    const isWindows: boolean = platform === 'win32';
    if (isWindows) {
        if (process.arch.toLowerCase() === 'x64' || process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432')) {
            operatingSystem = 'win64';
            bitness = '64';
        } else {
            operatingSystem = 'win32';
            bitness = '86';
        }
    } else if (platform === 'darwin' || platform === 'linux') {
        operatingSystem = platform;
        bitness = '64';
    } else {
        throw new RangeError(localize('unexpectedPlatform', 'Unexpected platform "{0}"', platform));
    }

    const webpackParentPath: string = join(ext.context.asAbsolutePath('dist'), 'node_modules');
    const debugParentPath: string = ext.context.asAbsolutePath('node_modules');
    const parentPathsToTry: string[] = [webpackParentPath, debugParentPath];
    for (const parentPath of parentPathsToTry) {
        let exePath: string = join(parentPath, '@azure-tools', `azcopy-${operatingSystem}`, 'dist', 'bin', `azcopy_${isWindows ? 'windows' : operatingSystem}_amd${bitness}`);
        if (isWindows) {
            exePath += '.exe';
        }
        if (await pathExists(exePath)) {
            return exePath;
        }
    }

    throw new Error(localize('azCopyExeNotFound', 'AzCopy executable not found'));
}
