/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as glob from 'glob';
import * as path from 'path';

export function isPathEqual(fsPath1: string, fsPath2: string): boolean {
    const relativePath: string = path.relative(fsPath1, fsPath2);
    return relativePath === '';
}

export function isSubpath(expectedParent: string, expectedChild: string): boolean {
    const relativePath: string = path.relative(expectedParent, expectedChild);
    return relativePath !== '' && !relativePath.startsWith('..') && relativePath !== expectedChild;
}

export async function listFilePathsWithAzureSeparator(directoryPath: string, ignoreGlobPattern?: string): Promise<string[]> {
    // Note: glob always returns paths with '/' separator, even on Windows, which also is the main separator used by Azure.
    return new Promise<string[]>(
        (resolve, reject) => {
            const ignore: string = ignoreGlobPattern ? path.join(directoryPath, ignoreGlobPattern) : '';
            glob(
                path.join(directoryPath, '**'),
                {
                    mark: true, // Add '/' to folders
                    dot: true, // Treat '.' as a normal character
                    nodir: true, // required for symlinks https://github.com/archiverjs/node-archiver/issues/311#issuecomment-445924055
                    follow: true, // Follow symlinks to get all sub folders https://github.com/microsoft/vscode-azurefunctions/issues/1289
                    ignore
                },
                (err, matches) => {
                    if (err) {
                        reject(err);
                    } else {
                        // Remove folders from source list
                        let filePaths = matches.filter(file => !isFolder(file));

                        resolve(filePaths);
                    }
                });
        });
}

function isFolder(file: string): boolean {
    return file.endsWith("/");
}
