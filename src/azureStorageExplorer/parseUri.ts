/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Example uri: /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/resourcegroup1/providers/Microsoft.Storage/storageAccounts/storageaccount1/Blob Containers/container1/parentdir1/subdir
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
     * e.g. parentdir1/subdir
     */
    filePath: string;

    /**
     * Same as `filePath`, just with a delimiter at the end in case this is a directory
     * e.g. parentdir1/subdir/
     */
    dirPath: string;

    /**
     * Path of parent directory within container or file share
     * e.g. parentdir1/
     */
    parentDirPath: string;

    /**
     * Name of file or directory
     * e.g. subdir
     */
    baseName: string;
}

export function parseUri(uri: vscode.Uri | string, fileType: string): IParsedUri {
    let path: string = uri instanceof vscode.Uri ? uri.path : uri;
    const matches: RegExpMatchArray | null = path.match(`^(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/[^\/]+\/${fileType}\/([^\/]+))\/?((.*?)\/?([^\/]*))$`);
    if (!matches) {
        throw new Error(`Invalid ${fileType} uri. Cannot view or modify ${uri}.`);
    } else {
        return {
            rootPath: matches[1],
            rootName: matches[2],
            filePath: matches[3],
            dirPath: matches[3] ? `${matches[3]}/` : '',
            parentDirPath: matches[4],
            baseName: matches[5]
        };
    }
}
