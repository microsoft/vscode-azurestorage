/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class FileStatImpl implements vscode.FileStat {
    constructor(
        // tslint:disable-next-line: no-reserved-keywords
        public type: vscode.FileType,
        public ctime: number,
        public mtime: number,
        public size: number) {
        this.type = type;
        this.ctime = ctime;
        this.mtime = mtime;
        this.size = size;
    }
}
