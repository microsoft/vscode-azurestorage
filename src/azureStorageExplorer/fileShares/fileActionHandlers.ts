/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from 'vscode-azureextensionui';
import { FileTreeItem } from './fileNode';

export function registerFileActionHandlers(): void {
    registerCommand("azureStorage.deleteFile", async (treeItem: FileTreeItem) => await treeItem.deleteTreeItem());
}
