/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { parseUri } from './parseUri';

export function showRenameError(oldUri: vscode.Uri, newUri: vscode.Uri, fileType: string, context: IActionContext): void {
    let oldUriParsed = parseUri(oldUri, fileType);
    let newUriParsed = parseUri(newUri, fileType);

    context.errorHandling.rethrow = true;
    if (oldUriParsed.baseName === newUriParsed.baseName) {
        // Set suppressDisplay true when trying to move the files because VS code will hanlde the error.
        context.errorHandling.suppressDisplay = true;
        throw new Error('Moving folders or files not supported.');
    } else {
        // When renaming a file, VS code will not handle the error so the message must be displayed here.
        throw new Error('Renaming folders or files not supported.');
    }
}
