/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

export interface IInitMessage {
    MessageType: "Init";
    MessageContent: {
        LogFileLocation: string;
        JobID: string;
    };
    TimeStamp: string;
}
