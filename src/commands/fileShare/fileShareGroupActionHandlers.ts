/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { FileShareGroupTreeItem } from '../../tree/fileShare/FileShareGroupTreeItem';
import { createChildNode } from '../commonTreeCommands';

export function registerFileShareGroupActionHandlers(): void {
    registerCommand("azureStorage.createFileShare", async (context: IActionContext, treeItem?: FileShareGroupTreeItem) => await createChildNode(context, FileShareGroupTreeItem.contextValue, treeItem));
}
