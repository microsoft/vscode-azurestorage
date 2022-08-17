/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { env } from "vscode";
import { ext } from "../extensionVariables";
import { localize } from "./localize";

export async function copyAndShowToast(text: string, name?: string): Promise<void> {
    await env.clipboard.writeText(text);
    ext.outputChannel.show();
    ext.outputChannel.appendLog(localize('copiedClipboard', '{1} copied to clipboard: {0}', text, name));
}
