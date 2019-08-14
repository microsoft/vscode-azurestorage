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
     * Either File Shares or Blob Containers
     */
    fileType: string;

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

export function parseUri(uri: vscode.Uri | string): IParsedUri {
    uri = uri instanceof vscode.Uri ? uri : vscode.Uri.parse(parseIncomingTreeItemUri(uri));
    let query: string = uri.query;
    // tslint:disable-next-line: no-multiline-string
    const queryMatches: RegExpMatchArray | null = query.match(`^resourceId=(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/[^\/]+\/([^\/]+)\/([^\/]+))$`);
    let uriPath: string = uri.path;
    // tslint:disable-next-line: no-multiline-string
    const pathMatches: RegExpMatchArray | null = uriPath.match(`^\/([^\/]+)\/?((.*?\/?)([^\/]*))$`);
    if (!pathMatches || !queryMatches) {
        throw new Error(`Invalid uri. Cannot view or modify ${uri}.`);
    } else {
        return {
            rootPath: queryMatches[1],
            fileType: queryMatches[2],
            rootName: queryMatches[3],
            filePath: pathMatches[2],
            dirPath: pathMatches[2] ? `${pathMatches[2]}/` : '',
            parentDirPath: pathMatches[3],
            baseName: pathMatches[4]
        };
    }
}

export function parseIncomingTreeItemUri(uri: vscode.Uri | string): string {
    let uriPath: string = uri instanceof vscode.Uri ? uri.path : uri;
    // tslint:disable-next-line: no-multiline-string
    const matches: RegExpMatchArray | null = uriPath.match(`^\/subscriptions\/([^\/]+)\/resourceGroups\/([^\/]+)\/providers\/Microsoft\.Storage\/storageAccounts\/([^\/]+)\/([^\/]+)\/([^\/]+)\/?(.*?)$`);
    if (!matches) {
        throw new RangeError(`Invalid uri. Cannot view or modify ${uri}.`);
    } else {
        let subscriptionName = matches[1];
        let resourceGroupName = matches[2];
        let storageAccountName = matches[3];
        let fileType = matches[4];
        let groupNodeName = matches[5];
        let filePath = matches[6];
        let totalFilePath = path.posix.join(groupNodeName, filePath);
        return `/${totalFilePath}?resourceId=/subscriptions/${subscriptionName}/resourceGroups/${resourceGroupName}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}/${fileType}/${groupNodeName}`;
    }
}
