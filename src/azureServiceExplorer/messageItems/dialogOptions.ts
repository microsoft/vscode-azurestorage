/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export namespace DialogOptions {
    export const cancel: vscode.MessageItem = { title: "Cancel", isCloseAffordance: true };
    export const no: vscode.MessageItem = { title: "No" };
    export const ok: vscode.MessageItem = { title: "OK" };
    export const yes: vscode.MessageItem = { title: "Yes" };
    export const upload: vscode.MessageItem = { title: "Upload" };
    export const uploadDontShowAgain: vscode.MessageItem = { title: "Always Upload" };
}
