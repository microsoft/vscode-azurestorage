/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import { posix } from 'path';
import { ITransferSrcOrDstTreeItem } from '../tree/ITransferSrcOrDstTreeItem';
import { copyAndShowToast } from '../utils/copyAndShowToast';

export async function generateSasUrl(_context: IActionContext, treeItem: ITransferSrcOrDstTreeItem): Promise<string> {
    const resourceUri = treeItem.resourceUri;
    const sasToken = treeItem.transferSasToken;
    const sasUrl: string = `${resourceUri}${posix.sep}${treeItem.remoteFilePath}?${sasToken}`;
    await copyAndShowToast(sasUrl, 'SAS Token and URL');
    return sasUrl;
}
