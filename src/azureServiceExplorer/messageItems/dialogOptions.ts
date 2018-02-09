/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export namespace DialogOptions {
    export const ok: vscode.MessageItem = { title: "OK" };
    export const uploadDontShowAgain: vscode.MessageItem = { title: "Always Upload" };
    export const cancel: vscode.MessageItem = { title: "Cancel", isCloseAffordance: true };
}
