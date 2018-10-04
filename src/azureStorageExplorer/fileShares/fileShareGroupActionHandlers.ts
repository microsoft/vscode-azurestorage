/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from 'vscode-azureextensionui';
import { FileShareGroupTreeItem } from './fileShareGroupNode';

export function registerFileShareGroupActionHandlers(): void {
    registerCommand("azureStorage.createFileShare", async (treeItem: FileShareGroupTreeItem) => await treeItem.createChild());
}
