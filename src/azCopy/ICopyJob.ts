/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

import { ChildProcess } from "child_process";
import { TokenRefresher } from "./OAuth/TokenRefresher";
import { IConflictPromptMessage } from "./Output/IPromptMessage";
import { TransferStatus } from "./Output/TransferStatus";

/**
 * Internal representation of a copy job. Includes extra information, such as
 * the child process, that we don't want to expose to users of the lib.
 */
export interface ICopyJob {
    azCopyProcess: ChildProcess;
    command: string;
    scanningStarted: boolean;
    canceled: boolean;
    killed: boolean;
    tokenRefresher?: TokenRefresher;
    azCopyJobId?: string;
    logFileLocation?: string;
    latestStatus?: TransferStatus;
    errorMessage?: string;
    promptMessage?: IConflictPromptMessage;
    lastMessageTime?: number;
}
