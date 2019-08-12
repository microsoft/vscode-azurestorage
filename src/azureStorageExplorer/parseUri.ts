/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
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

// ^\?resourceId=\/(subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/[^\/]+\/${fileType}\/([^\/]+))$
export function parseUri(uri: vscode.Uri | string, fileType: string): IParsedUri {
    uri = uri instanceof vscode.Uri ? uri : vscode.Uri.file(uri);
    let query: string = uri.query;
    const queryMatches: RegExpMatchArray | null = query.match(`^resourceId=(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/[^\/]+\/${fileType}\/([^\/]+))$`);
    let uriPath: string = uri.path;
    // tslint:disable-next-line: no-multiline-string
    const pathMatches: RegExpMatchArray | null = uriPath.match(`^\/([^\/]+)\/?((.*?\/?)([^\/]*))$`);
    if (!pathMatches || !queryMatches) {
        throw new Error(`Invalid ${fileType} uri. Cannot view or modify ${uri}.`);
    } else {
        return {
            rootPath: queryMatches[1],
            rootName: queryMatches[2],
            filePath: pathMatches[2],
            dirPath: pathMatches[2] ? `${pathMatches[2]}/` : '',
            parentDirPath: pathMatches[3],
            baseName: pathMatches[4]
        };
    }
}

export function parseIncomingTreeItemUri(uri: vscode.Uri | string, fileType: string): string {
    let uriPath: string = uri instanceof vscode.Uri ? uri.path : uri;
    const matches: RegExpMatchArray | null = uriPath.match(`^\/subscriptions\/([^\/]+)\/resourceGroups\/([^\/]+)\/providers\/Microsoft\.Storage\/storageAccounts\/([^\/]+)\/${fileType}\/([^\/]+)\/?(.*?)$`);
    if (!matches) {
        throw new RangeError(`Invalid ${fileType} uri.`);
    } else {
        let subscriptionName = matches[1];
        let resourceGroupName = matches[2];
        let storageAccountName = matches[3];
        let groupNodeName = matches[4];
        let filePath = matches[5];
        let totalFilePath = path.posix.join(groupNodeName, filePath);
        return `/${totalFilePath}?resourceId=/subscriptions/${subscriptionName}/resourceGroups/${resourceGroupName}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}/${fileType}/${groupNodeName}`;
    }
}
