/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

export interface IFailedTransfer {
    Src: string;
    Dst: string;
    TransferStatus: string;
    ErrorCode: number;
    IsFolderProperties?: boolean;
}
