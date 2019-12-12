/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { FileTreeItem } from '../../tree/fileShare/FileTreeItem';

export function registerFileActionHandlers(): void {
    registerCommand("azureStorage.deleteFile", async (context: IActionContext, treeItem: FileTreeItem) => await treeItem.deleteTreeItem(context));
}
