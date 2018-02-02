/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageItem } from "vscode";

// TODO: Unify with dialogOptions.ts
export namespace DialogBoxResponses {
    export const Yes: MessageItem = { title: "Yes" };
    export const OK: MessageItem = { title: "OK" };
    export const upload: MessageItem = { title: "Upload" };
    export const No: MessageItem = { title: "No" };
    export const Cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
}
