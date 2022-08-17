/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import { posix } from 'path';
import { env } from 'vscode';
import { IDownloadableTreeItem } from '../../tree/IDownloadableTreeItem';
import { getResourceUri } from './getResourceUri';
import { getSasToken } from './getSasToken';

export async function generateSASUrl(_context: IActionContext, treeItem: IDownloadableTreeItem): Promise<string> {
    const resourceUri = getResourceUri(treeItem);
    const sasToken = getSasToken(treeItem.root);

    const sasUrl: string = `${resourceUri}${posix.sep}${treeItem.remoteFilePath}?${sasToken}`;
    await env.clipboard.writeText(sasUrl);
    return sasUrl;
}
