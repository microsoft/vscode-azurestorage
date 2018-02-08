/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from "vscode";

// TODO: Unify with dialogOptions.ts
export namespace DialogBoxResponses {
    export const yes: MessageItem = { title: "Yes" };
    export const ok: MessageItem = { title: "OK" };
    export const upload: MessageItem = { title: "Upload" };
    export const no: MessageItem = { title: "No" };
    export const cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
}
