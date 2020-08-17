/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

/**
 * @Ze: is the only current use of this message is that scanning has started?
 */
export interface IInfoMessage {
    MessageType: "Info";
    MessageContent: string;
    TimeStamp: string;
}
