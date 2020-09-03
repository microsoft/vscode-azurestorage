/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, IAzCopyClient, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
import { CancellationToken, Progress } from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { ext } from '../../extensionVariables';
import { TransferProgress } from "../../TransferProgress";
import { delay } from "../../utils/delay";
import { throwIfCanceled } from "../../utils/errorUtils";
import { localize } from "../../utils/localize";

export async function azCopyTransfer(
    context: IActionContext,
    fromTo: FromToOption,
    src: ILocalLocation,
    dst: IRemoteSasLocation,
    transferProgress: TransferProgress,
    notificationProgress?: Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>,
    cancellationToken?: CancellationToken
): Promise<void> {
    const copyClient: AzCopyClient = new AzCopyClient();
    const copyOptions: ICopyOptions = { fromTo, overwriteExisting: "true", recursive: true, followSymLinks: true, excludePath: '.git;.vscode' };
    let jobId: string = await startAndWaitForCopy(context, copyClient, src, dst, copyOptions, transferProgress, notificationProgress, cancellationToken);
    let finalTransferStatus = (await copyClient.getJobInfo(jobId)).latestStatus;
    context.telemetry.properties.jobStatus = finalTransferStatus?.JobStatus;
    if (!finalTransferStatus || finalTransferStatus.JobStatus !== 'Completed') {
        // tslint:disable-next-line: strict-boolean-expressions
        let message: string = localize('azCopyTransfer', 'AzCopy Transfer: "{0}".', finalTransferStatus?.JobStatus || 'Failed');
        if (finalTransferStatus?.FailedTransfers?.length || finalTransferStatus?.SkippedTransfers?.length) {
            message += localize('checkOutputWindow', ' Check the output window for a list of incomplete transfers.');

            if (finalTransferStatus.FailedTransfers?.length) {
                ext.outputChannel.appendLog(localize('failedTransfers', 'Failed transfers:'));
                for (let failedTransfer of finalTransferStatus.FailedTransfers) {
                    ext.outputChannel.appendLog(`\t${failedTransfer.Dst}`);
                }
            }
            if (finalTransferStatus.SkippedTransfers?.length) {
                ext.outputChannel.appendLog(localize('skippedTransfers', 'Skipped transfers:'));
                for (let skippedTransfer of finalTransferStatus.SkippedTransfers) {
                    ext.outputChannel.appendLog(`\t${skippedTransfer.Dst}`);
                }
            }
        } else {
            // Add an additional error log since we don't have any more info about the failure
            ext.outputChannel.appendLog(localize('couldNotUpload', 'Could not upload "{0}"', src.path));
        }
        message += finalTransferStatus?.ErrorMsg ? ` ${finalTransferStatus.ErrorMsg}` : '';

        if (finalTransferStatus?.JobStatus && /CompletedWith*/gi.test(finalTransferStatus.JobStatus)) {
            // tslint:disable-next-line: no-floating-promises
            ext.ui.showWarningMessage(message);
        } else {
            throw new Error(message);
        }
    }
}

async function startAndWaitForCopy(
    context: IActionContext,
    copyClient: IAzCopyClient,
    src: AzCopyLocation,
    dst: AzCopyLocation,
    options: ICopyOptions,
    transferProgress: TransferProgress,
    notificationProgress?: Progress<{
        message?: string | undefined;
        increment?: number | undefined;
    }>,
    cancellationToken?: CancellationToken
): Promise<string> {
    let jobId: string = await copyClient.copy(src, dst, options);
    let status: TransferStatus | undefined;
    let finishedWork: number;
    while (!status || status.StatusType !== 'EndOfJob') {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'startAndWaitForCopy');
        status = (await copyClient.getJobInfo(jobId)).latestStatus;

        // Directory transfers always have `useWildCard` set
        // tslint:disable-next-line: strict-boolean-expressions
        finishedWork = (src.useWildCard ? status?.TransfersCompleted : status?.BytesOverWire) || 0;
        transferProgress.reportToOutputWindow(finishedWork);
        if (!!notificationProgress) {
            transferProgress.reportToNotification(finishedWork, notificationProgress);
        }
        await delay(1000);
    }

    return jobId;
}
