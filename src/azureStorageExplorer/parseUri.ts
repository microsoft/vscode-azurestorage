/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as querystring from 'querystring';
import * as vscode from 'vscode';

/**
 * Example uri: azurestorage:///container1/parentdir/subdir/blob?resourceId=/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/resourcegroup1/providers/Microsoft.Storage/storageAccounts/storageaccount1/Blob Containers/container1
 */
export interface IParsedUri {
    /**
     * ID of container or file share
     * e.g. /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/resourcegroup1/providers/Microsoft.Storage/storageAccounts/storageaccount1/Blob Containers/container1
     */
    resourceId: string;

    /**
     * Full path within container or file share
     * e.g. parentdir/subdir/blob
     */
    filePath: string;

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
    const parsedQuery: { [key: string]: string | undefined } = querystring.parse<{}>(uri.query);
    const resourceId = parsedQuery.resourceId;

    const filePath: string = uri.path.replace(/^\/[^\/]*\/?/, ''); // Remove rootName
    let parentDirPath = path.dirname(filePath);
    parentDirPath = parentDirPath === '.' ? '' : parentDirPath;
    const baseName = path.basename(filePath);

    if (!resourceId || !uri.path) {
        throw new Error(`Invalid uri. Cannot view or modify ${uri}.`);
    } else {
        return {
            resourceId,
            filePath,
            parentDirPath,
            baseName
        };
    }
}

export function idToUri(resourceId: string, filePath?: string): vscode.Uri {
    const rootName = path.basename(resourceId);
    return vscode.Uri.parse(`azurestorage:///${path.posix.join(rootName, filePath ? filePath : '')}?resourceId=${resourceId}`);
}
