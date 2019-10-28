/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as vscode from 'vscode';

export function idToUri(resourceId: string, filePath?: string): vscode.Uri {
    const rootName = path.basename(resourceId);
    return vscode.Uri.parse(`azurestorage:///${path.posix.join(rootName, filePath ? filePath : '')}?resourceId=${resourceId}`);
}
