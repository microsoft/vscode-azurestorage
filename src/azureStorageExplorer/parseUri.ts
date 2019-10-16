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
     * Type of resource
     * e.g. Blob Containers
     * e.g. File Shares
     */
    resourceType: string;

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
    const queryMatches: RegExpMatchArray | null = uri.query.match('^resourceId=(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/[^\/]+\/([^\/]+)\/([^\/]+))$');
    const pathMatches: RegExpMatchArray | null = uri.path.match('^\/([^\/]+[^\/]+)\/?((.*?)\/?([^\/]*))$');
    if (!pathMatches || !queryMatches) {
        throw new Error(`Invalid uri. Cannot view or modify ${uri}.`);
    } else {
        return {
            rootPath: queryMatches[1],
            resourceType: queryMatches[2],
            rootName: queryMatches[3],
            filePath: pathMatches[2],
            dirPath: pathMatches[2] ? `${pathMatches[2]}/` : '',
            parentDirPath: pathMatches[3],
            baseName: pathMatches[4]
        };
    }
}

export function idToUri(id: string): vscode.Uri {
    const matches: RegExpMatchArray | null = id.match('^\/subscriptions\/([^\/]+)\/resourceGroups\/([^\/]+)\/providers\/Microsoft\.Storage\/storageAccounts\/([^\/]+)\/([^\/]+)\/([^\/]+)\/?(.*?)\/*$');
    if (!matches) {
        throw new RangeError(`Invalid id. Cannot view or modify ${id}.`);
    } else {
        const subscriptionName = matches[1];
        const resourceGroupName = matches[2];
        const storageAccountName = matches[3];
        const resourceType = matches[4];
        const groupNodeName = matches[5];
        const filePath = matches[6];
        return vscode.Uri.parse(`azurestorage:///${path.posix.join(groupNodeName, filePath)}?resourceId=/subscriptions/${subscriptionName}/resourceGroups/${resourceGroupName}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}/${resourceType}/${groupNodeName}`);
    }
}
