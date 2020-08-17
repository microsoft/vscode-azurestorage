/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TransferStatus } from "./Output/TransferStatus";

export interface IJobInfo {
    command: string;
    scanningStarted: boolean;
    canceled: boolean;
    killed: boolean;
    logFileLocation?: string;
    latestStatus?: TransferStatus;
    errorMessage?: string;
    lastMessageTime?: number;
}
