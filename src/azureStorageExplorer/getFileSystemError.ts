/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from "vscode-azureextensionui";

export function getFileSystemError(uri: vscode.Uri, context: IActionContext, fsError: (messageOrUri?: string | vscode.Uri) => vscode.FileSystemError): vscode.FileSystemError {
    context.errorHandling.rethrow = true;
    context.errorHandling.suppressDisplay = true;
    return fsError(uri);
}
