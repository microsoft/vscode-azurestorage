/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ext } from '../extensionVariables';
import { StorageAccountModel } from '../tree/StorageAccountModel';
import { localize } from "../utils/localize";

export async function copyUrl(_actionContext: IActionContext, treeItem: StorageAccountModel): Promise<void> {
    const url = treeItem.copyUrl?.toString();

    if (url) {
        await vscode.env.clipboard.writeText(url);
        ext.outputChannel.show();
        ext.outputChannel.appendLog(localize('commands.copyUrl.urlCopied', 'URL copied to clipboard: {0}', url));
    }
}
