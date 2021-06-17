/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { dirname } from 'path';
import { FileStat, FileType, Uri, workspace } from 'vscode';
import { parseError } from 'vscode-azureextensionui';

export namespace AzExtFsExtra {
    export async function isDirectory(path: string): Promise<boolean> {
        const dir = Uri.file(path);
        const stats = await workspace.fs.stat(dir);
        return stats.type === FileType.Directory;
    }

    export async function isFile(path: string): Promise<boolean> {
        const dir = Uri.file(path);
        const stats = await workspace.fs.stat(dir);
        return stats.type === FileType.File;
    }

    export async function ensureDir(path: string): Promise<void> {
        const dir = Uri.file(path);
        try {
            await isDirectory(path);
        } catch (err) {
            // throws a vscode.FileSystemError is it doesn't exist
            const pError = parseError(err);
            if (pError && pError.errorType === 'FileNotFound') {
                await workspace.fs.createDirectory(dir);
            } else {
                throw err
            }
        }
    }

    export async function ensureFile(path: string): Promise<void> {
        try {
            // file exists so exit
            if (await isFile(path)) return;
        } catch (err) {
            const dir: string = dirname(path);
            await ensureDir(dir);
        }

        const file = Uri.file(path);
        await workspace.fs.writeFile(file, Buffer.from(''));
    }

    export async function readFile(path: string): Promise<string> {
        const file = Uri.file(path);
        return (await workspace.fs.readFile(file)).toString();
    }

    export async function writeFile(path: string, contents: string): Promise<void> {
        const file = Uri.file(path);
        await workspace.fs.writeFile(file, Buffer.from(contents));
    }

    export async function pathExists(path: string): Promise<boolean> {
        let stats: FileStat | undefined;
        const file = Uri.file(path);
        try {
            stats = await workspace.fs.stat(file);
        } catch { /*ignore*/ }
        return !!stats;
    }
}
