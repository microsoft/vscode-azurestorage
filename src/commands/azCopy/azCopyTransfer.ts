/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, IAzCopyClient, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
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
    const copyClient: AzCopyClient = new AzCopyClient();
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
                ext.outputChannel.appendLog(localize('failedTransfers', 'Failed transfers:'));
                for (let failedTransfer of finalTransferStatus.FailedTransfers) {
                    ext.outputChannel.appendLog(`\t${failedTransfer.Dst}`);
                }
            }
            if (finalTransferStatus.SkippedTransfers) {
                ext.outputChannel.appendLog(localize('skippedTransfers', 'Skipped transfers:'));
                for (let skippedTransfer of finalTransferStatus.SkippedTransfers) {
                    ext.outputChannel.appendLog(`\t${skippedTransfer.Dst}`);
                }
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
