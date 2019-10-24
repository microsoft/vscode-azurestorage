/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as vscode from 'vscode';

/**
 * Example uri: azurestorage:///container1/parentdir/subdir/blob?resourceId=/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/resourcegroup1/providers/Microsoft.Storage/storageAccounts/storageaccount1/Blob Containers/container1
 */
export interface IParsedUri {
    /**
     * Path to container or file share
     * e.g. /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/resourcegroup1/providers/Microsoft.Storage/storageAccounts/storageaccount1/Blob Containers/container1
     */
    rootPath: string;

    /**
     * Name of container or file share
     * e.g. container1
     */
    rootName: string;

    /**
     * Full path within container or file share
     * e.g. parentdir/subdir/blob
     */
    filePath: string;

    /**
     * Same as `filePath`, just with a delimiter at the end in case this is a directory
     * e.g. parentdir/subdir/blob/
     */
    dirPath: string;

    /**
     * Path of parent directory within container or file share
     * e.g. parentdir/subdir
     */
    parentDirPath: string;

    /**
     * Name of file or directory
     * e.g. blob
     */
    baseName: string;
}

export function parseUri(uri: vscode.Uri): IParsedUri {
    const queryMatches: RegExpMatchArray | null = uri.query.match('^resourceId=(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/[^\/]+\/[^\/]+\/([^\/]+))$');
    const pathMatches: RegExpMatchArray | null = uri.path.match('^\/[^\/]+[^\/]+\/?((.*?)\/?([^\/]*))$');
    if (!pathMatches || !queryMatches) {
        throw new Error(`Invalid uri. Cannot view or modify ${uri}.`);
    } else {
        return {
            rootPath: queryMatches[1],
            rootName: queryMatches[2],
            filePath: pathMatches[1],
            dirPath: pathMatches[1] ? `${pathMatches[1]}/` : '',
            parentDirPath: pathMatches[2],
            baseName: pathMatches[3]
        };
    }
}

export function idToUri(rootPath: string, filePath?: string): vscode.Uri {
    const rootName = path.basename(rootPath);
    return vscode.Uri.parse(`azurestorage:///${path.posix.join(rootName, filePath ? filePath : '')}?resourceId=${rootPath}`);
}
