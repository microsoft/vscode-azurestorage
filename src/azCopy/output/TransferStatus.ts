/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFailedTransfer } from "../Transfers/IFailedTransfer";
import { ISkippedTransfer } from "../Transfers/ISkippedTransfer";

export type ProgressJobStatus = "InProgress" | "Cancelling";
export type ExitJobStatus = "Cancelled" | "Completed" | "CompletedWithSkipped" | "CompletedWithErrors" | "CompletedWithErrorsAndSkipped" | "Failed";
export type JobStatus = ProgressJobStatus | ExitJobStatus;

export type TransferStatus =
    ITransferStatus<"Progress", ProgressJobStatus> |
    ITransferStatus<"EndOfJob", ExitJobStatus>;

export interface ITransferStatus<
    StatusTypeT,
    JobStatusT> {
    StatusType: StatusTypeT;
    ActiveConnections: number;
    CompleteJobOrdered: boolean;
    JobStatus: JobStatusT;
    TotalTransfers: number;
    TransfersCompleted: number;
    TransfersFailed: number;
    TransfersSkipped: number;
    /**
     * Number in [0, 100] representing the percentage progress of the transfer.
     */
    PercentComplete: number;
    /**
     * Sum of the bytes which have been sent/read over the wire.
     */
    BytesOverWire: number;
    /**
     * Sum of the bytes from completed transfers.
     */
    TotalBytesTransferred: number;
    /**
     * Sum of the bytes from all transfers which have been discovered.
     */
    TotalBytesEnumerated: number;
    FailedTransfers: IFailedTransfer[] | null;
    SkippedTransfers: ISkippedTransfer[] | null;
    /**
     * Whether the transfers are/were (in the case of "EndOfJob") being slowed down due to a slow disk.
     */
    IsDiskConstrained: boolean;
    /**
     * Date in YYYY-MM-DDTHH:mm:ss.SSSSSSZ ISO 8601 - Micros
     * SSSSSS are time in microseconds
     */
    TimeStamp: string;
    /**
     * Typically only used when a job breaks in a very unexpected way, such as plan files being deleted mid way through a transfer.
     */
    ErrorMsg?: string;
}
