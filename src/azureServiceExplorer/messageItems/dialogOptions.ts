/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

export default class DialogOptions {
    static readonly OK: vscode.MessageItem = { title: "OK" };
    static readonly DontShowAgain: vscode.MessageItem = { title: "Don't Show Again" };
    static readonly Cancel: vscode.MessageItem = { title: "Cancel", isCloseAffordance: true };
}
