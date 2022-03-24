/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, IActionContext, registerCommand } from '@microsoft/vscode-azext-utils';
import { DirectoryTreeItem } from '../../tree/fileShare/DirectoryTreeItem';
import { IFileShareCreateChildContext } from '../../tree/fileShare/FileShareTreeItem';

export function registerDirectoryActionHandlers(): void {
    registerCommand("azureStorage.deleteDirectory", async (context: IActionContext, treeItem: AzExtParentTreeItem) => await treeItem.deleteTreeItem(context));
    registerCommand("azureStorage.createSubdirectory", async (context: IActionContext, treeItem: AzExtParentTreeItem) => await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: DirectoryTreeItem.contextValue }));

    // Note: azureStorage.createTextFile is registered in fileShareActionHandlers
}
