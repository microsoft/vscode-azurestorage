/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureParentTreeItem, registerCommand } from 'vscode-azureextensionui';
import { DirectoryTreeItem } from './directoryNode';

export function registerDirectoryActionHandlers(): void {
    registerCommand("azureStorage.deleteDirectory", async (treeItem: AzureParentTreeItem) => await treeItem.deleteTreeItem());
    registerCommand("azureStorage.createSubdirectory", async (treeItem: AzureParentTreeItem) => await treeItem.createChild(DirectoryTreeItem.contextValue));

    // Note: azureStorage.createTextFile is registered in fileShareActionHandlers
}
