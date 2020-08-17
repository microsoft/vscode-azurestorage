/*!---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *----------------------------------------------------------*/

import { ConflictResponse } from "./ConflictResponse";

export type IConflictPromptMessage = IPromptMessage<"Overwrite" | "Cancel", ConflictResponse>;

export interface IPromptMessage<PromptTypeT, ResponseStringT> {
    MessageType: "Prompt";
    TimeStamp: string;
    /**
     * `MessageContent` is a human readable string describing what this prompt message is for
     */
    MessageContent: string;
    PromptDetails: {
        PromptType: PromptTypeT;
        ResponseOptions: {
            /**
             * A unique CamelCase display string for this response
             */
            ResponseType: string;
            /**
             * A sentence-like display string for this response
             */
            UserFriendlyResponseType: string;
            /**
             * The exact string to be entered to the stdin
             */
            ResponseString: ResponseStringT;
        }[];
        /**
         * The path to the resouce with conflict
         */
        PromptTarget: string;
    };
}
