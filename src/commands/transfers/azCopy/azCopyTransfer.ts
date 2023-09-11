/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzCopyClient, AzCopyLocation, FromToOption, ICopyOptions, ILocalLocation, IRemoteSasLocation, TransferStatus } from "@azure-tools/azcopy-node";
// eslint-disable-next-line import/no-internal-modules
import { IJobInfo } from "@azure-tools/azcopy-node/dist/src/IJobInfo";
// eslint-disable-next-line import/no-internal-modules
import { ExitJobStatus, ITransferStatus, ProgressJobStatus } from "@azure-tools/azcopy-node/dist/src/Output/TransferStatus";
import { IActionContext } from "@microsoft/vscode-azext-utils";
import { CancellationToken, Uri } from 'vscode';
import { TransferProgress } from "../../../TransferProgress";
import { NotificationProgress } from "../../../constants";
import { ext } from '../../../extensionVariables';
import { delay } from "../../../utils/delay";
import { throwIfCanceled } from "../../../utils/errorUtils";
import { localize } from "../../../utils/localize";

interface ITransferLocation {
    src: AzCopyLocation;
    dst: AzCopyLocation;
}

type AzCopyTransferStatus = ITransferStatus<"Progress", ProgressJobStatus> | ITransferStatus<"EndOfJob", ExitJobStatus> | undefined;

export async function azCopyTransfer(
    context: IActionContext,
    fromTo: FromToOption,
    src: ILocalLocation | IRemoteSasLocation,
    dst: ILocalLocation | IRemoteSasLocation,
    transferProgress: TransferProgress,
    notificationProgress?: NotificationProgress,
    cancellationToken?: CancellationToken
): Promise<void> {
    // `followSymLinks: true` causes downloads to fail (which is expected) but it currently doesn't work as expected for uploads: https://github.com/Azure/azure-storage-azcopy/issues/1174
    // So it's omitted from `copyOptions` for now
    const copyOptions: ICopyOptions = { fromTo, overwriteExisting: "true", recursive: true, excludePath: '.git/;.vscode/' };
    const jobInfo: IJobInfo = await startAndWaitForTransfer(context, { src, dst }, copyOptions, transferProgress, notificationProgress, cancellationToken);
    handleJob(context, jobInfo, src.path);
}

function handleJob(context: IActionContext, jobInfo: IJobInfo, transferLabel: string): void {
    const finalTransferStatus: AzCopyTransferStatus = jobInfo.latestStatus;
    context.telemetry.properties.jobStatus = finalTransferStatus?.JobStatus;
    if (!finalTransferStatus || finalTransferStatus.JobStatus !== 'Completed') {
        let message: string = jobInfo.errorMessage || finalTransferStatus?.ErrorMsg || localize('azCopyTransfer', 'AzCopy Transfer: "{0}". ', finalTransferStatus?.JobStatus || 'Unknown');
        if (finalTransferStatus?.FailedTransfers?.length || finalTransferStatus?.SkippedTransfers?.length) {
            message += localize('checkOutputWindow', ' Check the [output window](command:{0}) for a list of incomplete transfers.', `${ext.prefix}.showOutputChannel`);

            if (finalTransferStatus.FailedTransfers?.length) {
                ext.outputChannel.appendLog(localize('failedTransfers', 'Failed transfer(s):'));
                for (const failedTransfer of finalTransferStatus.FailedTransfers) {
                    ext.outputChannel.appendLog(`\t${failedTransfer.Dst}`);
                }
            }
            if (finalTransferStatus.SkippedTransfers?.length) {
                ext.outputChannel.appendLog(localize('skippedTransfers', 'Skipped transfer(s):'));
                for (const skippedTransfer of finalTransferStatus.SkippedTransfers) {
                    ext.outputChannel.appendLog(`\t${skippedTransfer.Dst}`);
                }
            }
        } else {
            // Add an additional error log since we don't have any more info about the failure
            ext.outputChannel.appendLog(localize('couldNotTransfer', 'Could not transfer "{0}"', transferLabel));

            if (finalTransferStatus?.JobStatus === 'Failed' && process.platform === 'linux') {
                message += localize('viewHelp', ' View help with [known issues](https://aka.ms/AAb0i6o).');
            }
        }

        if (jobInfo.logFileLocation) {
            const uri: Uri = Uri.file(jobInfo.logFileLocation);
            ext.outputChannel.appendLog(localize('logFile', 'Log file: {0}', uri.toString()));
        }

        if (finalTransferStatus?.JobStatus && /CompletedWith*/gi.test(finalTransferStatus.JobStatus)) {
            void context.ui.showWarningMessage(message);
        } else {
            throw new Error(message);
        }
    }
}

async function startAndWaitForTransfer(
    context: IActionContext,
    location: ITransferLocation,
    options: ICopyOptions,
    transferProgress: TransferProgress,
    notificationProgress?: NotificationProgress,
    cancellationToken?: CancellationToken
): Promise<IJobInfo> {
    const copyClient: AzCopyClient = new AzCopyClient();
    const jobId: string = await copyClient.copy(location.src, location.dst, options);

    // Directory transfers always have `useWildCard` set
    const displayWorkAsTotalTransfers: boolean = location.src.useWildCard;

    let status: TransferStatus | undefined;
    let finishedWork: number;
    let totalWork: number | undefined;
    while (!status || status.StatusType !== 'EndOfJob') {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'startAndWaitForTransfer');
        status = (await copyClient.getJobInfo(jobId)).latestStatus;

        totalWork = (displayWorkAsTotalTransfers ? status?.TotalTransfers : status?.TotalBytesEnumerated) || undefined;
        finishedWork = (displayWorkAsTotalTransfers ? status?.TransfersCompleted : status?.BytesOverWire) || 0;
        if (totalWork) {
            // Only report progress if we have `totalWork`
            transferProgress.reportToOutputWindow(finishedWork, totalWork);
            if (notificationProgress) {
                transferProgress.reportToNotification(finishedWork, totalWork, notificationProgress);
            }
        }
        await delay(1000);
    }

    return await copyClient.getJobInfo(jobId);
}
