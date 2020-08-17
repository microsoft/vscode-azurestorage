/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

import { IFailedTransfer } from "../transfers/IFailedTransfer";
import { ISkippedTransfer } from "../transfers/ISkippedTransfer";

export interface IEndOfJobMessage {
    MessageType: "EndOfJob";
    MessageContent: {
        ActiveConnections: number;
        CompleteJobOrdered: boolean;
        JobStatus: "Cancelled" | "Completed" | "CompletedWithSkipped" | "CompletedWithErrors" | "CompletedWithErrorsAndSkipped" | "Failed"
        TotalTransfers: number;
        TransfersCompleted: number;
        TransfersFailed: number;
        TransfersSkipped: number;
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
         * Typically only used when a job breaks in a very unexpected way, such as plan files being deleted mid way through a transfer.
         */
        ErrorMsg?: string;
    };
    TimeStamp: string;
}
