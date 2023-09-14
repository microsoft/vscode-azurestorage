/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { Uri, workspace } from 'vscode';

export function isPathEqual(fsPath1: string, fsPath2: string): boolean {
    const relativePath: string = path.relative(fsPath1, fsPath2);
    return relativePath === '';
}

export function isSubpath(expectedParent: string, expectedChild: string): boolean {
    const relativePath: string = path.relative(expectedParent, expectedChild);
    return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
}

export async function isEmptyDirectory(pathOrUri: Uri | string): Promise<boolean> {
    if (typeof pathOrUri === 'string') {
        pathOrUri = vscode.Uri.file(pathOrUri)
    }

    const files = await workspace.fs.readDirectory(pathOrUri);
    if (files.length === 0) {
        return true;
    }
    return false;
}
