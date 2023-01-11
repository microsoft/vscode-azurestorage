/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommandWithTreeNodeUnwrapping } from '@microsoft/vscode-azext-utils';
import { FileShareGroupTreeItem } from '../../tree/fileShare/FileShareGroupTreeItem';
import { createChildNode } from '../commonTreeCommands';

export function registerFileShareGroupActionHandlers(): void {
    registerCommandWithTreeNodeUnwrapping("azureStorage.createFileShare", createFileShare);
}

export async function createFileShare(context: IActionContext, treeItem?: FileShareGroupTreeItem): Promise<void> {
    await createChildNode(context, FileShareGroupTreeItem.contextValue, treeItem);
}
