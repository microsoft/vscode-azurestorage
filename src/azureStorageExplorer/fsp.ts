/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { FileShareTreeItem } from './fileShares/fileShareNode';

export function parseUri2(uri: vscode.Uri, fileType: string): { accountName: string, rootPath: string, groupTreeItemName: string, parentPath: string, baseName: string } {
    let parsedUri = path.parse(uri.path);
    let subscriptUri = parsedUri.dir.substring(0, parsedUri.dir.indexOf(fileType) - 1);
    let accountName = subscriptUri.substring(subscriptUri.lastIndexOf('/') + 1);

    if (parsedUri.base === fileType && parsedUri.dir === '') {
        return { accountName: accountName, rootPath: uri.path, groupTreeItemName: '', parentPath: '', baseName: '' };
    }

    let rootPathEndIndx = parsedUri.dir.indexOf(fileType) + fileType.length;
    let postRootPath = rootPathEndIndx === parsedUri.dir.length ? '' : parsedUri.dir.substring(rootPathEndIndx + 1);
    let groupTreeItemNameEndIndx = postRootPath.indexOf('/');

    let rootPath = parsedUri.dir.substring(0, rootPathEndIndx);
    let groupTreeItemName = groupTreeItemNameEndIndx === -1 ? (postRootPath === '' ? parsedUri.base : postRootPath) : postRootPath.substring(0, groupTreeItemNameEndIndx);
    let parentPath = groupTreeItemNameEndIndx === -1 ? '' : postRootPath.substring(groupTreeItemNameEndIndx + 1);
    let baseName = parsedUri.base;

    if (baseName === groupTreeItemName) {
        return { accountName: accountName, rootPath, groupTreeItemName, parentPath: '', baseName: '' };
    }

    return { accountName: accountName, rootPath, groupTreeItemName, parentPath, baseName };
}

export function parseUri(uri: vscode.Uri, fileType: string): { accountName: string, rootPath: string, groupTreeItemName: string, parentPath: string, baseName: string } {

    const matches: RegExpMatchArray | null = uri.path.match(`^\/subscriptions\/.*\/resourceGroups\/.*\/providers\/.*\/storageAccounts\/(.*)\/${fileType}\/?([^\/]*)\/?(.*?)\/?([^\/]*)$`);

    if (!matches || matches[1] === '') {
        throw new RangeError('Uri not understood.');
    }

    let accountName = matches[1];
    if (matches[2] === '') {
        if (matches[3] === '' && matches[3] === '') {
            return { accountName: accountName, rootPath: uri.path, groupTreeItemName: '', parentPath: '', baseName: '' };
        } else {
            throw new Error(`${fileType} name in uri not properly formatted.`);
        }
    }

    const matchesTemp: RegExpMatchArray | null = uri.path.match(`^(.*)\/${fileType}\/(.*)$`);
    if (!matchesTemp) {
        throw new RangeError(`Not valid ${fileType} uri`);
    }

    let rootPath: string = `${matchesTemp[1]}/${fileType}`;

    return { accountName, rootPath, groupTreeItemName: matches[2], parentPath: matches[3], baseName: matches[4] };
}

export async function findRoot(uri: vscode.Uri, fileTypeString: string): Promise<AzExtTreeItem | undefined> {
    return <FileShareTreeItem>await callWithTelemetryAndErrorHandling('(blob/fs).findRoot', async (context) => {
        context.errorHandling.rethrow = true;
        context.errorHandling.suppressDisplay = true;

        let parsedUri = parseUri(uri, fileTypeString);
        let rootPath = path.join(parsedUri.rootPath, parsedUri.groupTreeItemName);
        return await ext.tree.findTreeItem(rootPath, context);
    });
}
