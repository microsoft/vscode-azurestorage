/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, IAzCopyClient, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
import { CancellationToken } from 'vscode';
import { IActionContext } from "vscode-azureextensionui";
import { NotificationProgress } from "../../constants";
import { ext } from '../../extensionVariables';
import { TransferProgress } from "../../TransferProgress";
import { delay } from "../../utils/delay";
import { throwIfCanceled } from "../../utils/errorUtils";
import { localize } from "../../utils/localize";

export async function azCopyTransfer(
    context: IActionContext,
    fromTo: FromToOption,
    src: ILocalLocation | IRemoteSasLocation,
    dst: ILocalLocation | IRemoteSasLocation,
    transferProgress: TransferProgress,
    notificationProgress?: NotificationProgress,
    cancellationToken?: CancellationToken
): Promise<void> {
    const copyClient: AzCopyClient = new AzCopyClient();
    // `followSymLinks: true` causes downloads to fail (which is expected) but it currently doesn't work as expected for uploads: https://github.com/Azure/azure-storage-azcopy/issues/1174
    // So it's omitted from `copyOptions` for now
    const copyOptions: ICopyOptions = { fromTo, overwriteExisting: "true", recursive: true, excludePath: '.git;.vscode' };
    let jobId: string = await startAndWaitForCopy(context, copyClient, src, dst, copyOptions, transferProgress, notificationProgress, cancellationToken);
    let finalTransferStatus = (await copyClient.getJobInfo(jobId)).latestStatus;
    context.telemetry.properties.jobStatus = finalTransferStatus?.JobStatus;
    if (!finalTransferStatus || finalTransferStatus.JobStatus !== 'Completed') {
        // tslint:disable-next-line: strict-boolean-expressions
        let message: string = localize('azCopyTransfer', 'AzCopy Transfer: "{0}".', finalTransferStatus?.JobStatus || 'Failed');
        if (finalTransferStatus?.FailedTransfers?.length || finalTransferStatus?.SkippedTransfers?.length) {
            message += localize('checkOutputWindow', ' Check the output window for a list of incomplete transfers.');

            // The optional "s" at the end of "transfer(s)"
            let s: string;
            if (finalTransferStatus.FailedTransfers?.length) {
                s = finalTransferStatus.FailedTransfers.length > 1 ? 's' : '';
                ext.outputChannel.appendLog(localize('failedTransfers', 'Failed transfer{0}:', s));
                for (let failedTransfer of finalTransferStatus.FailedTransfers) {
                    ext.outputChannel.appendLog(`\t${failedTransfer.Dst}`);
                }
            }
            if (finalTransferStatus.SkippedTransfers?.length) {
                s = finalTransferStatus.SkippedTransfers.length > 1 ? 's' : '';
                ext.outputChannel.appendLog(localize('skippedTransfers', 'Skipped transfer{0}:', s));
                for (let skippedTransfer of finalTransferStatus.SkippedTransfers) {
                    ext.outputChannel.appendLog(`\t${skippedTransfer.Dst}`);
                }
            }
        } else {
            // Add an additional error log since we don't have any more info about the failure
            ext.outputChannel.appendLog(localize('couldNotTransfer', 'Could not transfer "{0}"', src.path));
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
    notificationProgress?: NotificationProgress,
    cancellationToken?: CancellationToken
): Promise<string> {
    let jobId: string = await copyClient.copy(src, dst, options);
    let status: TransferStatus | undefined;
    let finishedWork: number;
    let totalWork: number | undefined;
    while (!status || status.StatusType !== 'EndOfJob') {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'startAndWaitForCopy');
        status = (await copyClient.getJobInfo(jobId)).latestStatus;

        // tslint:disable: strict-boolean-expressions
        // Directory transfers always have `useWildCard` set
        totalWork = (src.useWildCard ? status?.TotalTransfers : status?.TotalBytesEnumerated) || undefined;
        finishedWork = (src.useWildCard ? status?.TransfersCompleted : status?.BytesOverWire) || 0;
        // tslint:enable: strict-boolean-expressions

        if (totalWork || transferProgress.totalWork) {
            // Only report progress if we have `totalWork`
            transferProgress.reportToOutputWindow(finishedWork, totalWork);
            if (!!notificationProgress) {
                transferProgress.reportToNotification(finishedWork, notificationProgress);
            }
        }
        await delay(1000);
    }

    return jobId;
}
