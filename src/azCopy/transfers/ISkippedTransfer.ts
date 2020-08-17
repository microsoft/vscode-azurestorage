/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

export interface ISkippedTransfer {
    Src: string;
    Dst: string;
    TransferStatus: string;
    ErrorCode: number;
    IsFolderProperties?: boolean;
}
