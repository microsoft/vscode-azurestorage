/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzExtTreeItem, callWithTelemetryAndErrorHandling } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { FileShareTreeItem } from './fileShares/fileShareNode';
import { parseUri } from './parseUri';

// export function parseUri(uri: vscode.Uri, fileType: string): { accountName: string, rootPath: string, groupTreeItemName: string, parentPath: string, baseName: string } {
//     const matches: RegExpMatchArray | null = uri.path.match(`^(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/([^\/]+)\/${fileType}\/?([^\/]+)\/?(.*?)\/?([^\/]*))$`);
//     // const matches: RegExpMatchArray | null = uri.path.match(`^(\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+\/providers\/Microsoft\.Storage\/storageAccounts\/[^\/]+\/${fileType}\/([^\/]+))\/?((.*?\/?)([^\/]*))$`);
//     if (!matches || matches[1] === '') {
//         throw new RangeError(`Not valid ${fileType} uri`);
//     }

//     if (`${matches[2]}${matches[3]}${matches[4]}` === '') {
//         return { accountName: matches[1], rootPath: uri.path, groupTreeItemName: '', parentPath: '', baseName: '' };
//     }

//     if (matches[2] === '') {
//         throw new Error(`${fileType} name in uri not properly formatted.`);
//     }

//     const matchesTemp: RegExpMatchArray | null = uri.path.match(`^(.*)\/${fileType}\/(.*)$`);
//     if (!matchesTemp) {
//         throw new RangeError(`Not valid ${fileType} uri`);
//     }

//     return { accountName: matches[1], rootPath: `${matchesTemp[1]}/${fileType}`, groupTreeItemName: matches[2], parentPath: matches[3], baseName: matches[4] };
// }

export async function findRoot(uri: vscode.Uri, fileTypeString: string): Promise<AzExtTreeItem | undefined> {
    return <FileShareTreeItem>await callWithTelemetryAndErrorHandling('(blob/fs).findRoot', async (context) => {
        context.errorHandling.rethrow = true;
        context.errorHandling.suppressDisplay = true;

        let parsedUri = parseUri(uri, fileTypeString);
        return await ext.tree.findTreeItem(parsedUri.rootPath, context);
    });
}
