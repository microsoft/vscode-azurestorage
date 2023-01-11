/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, IActionContext, registerCommandWithTreeNodeUnwrapping } from '@microsoft/vscode-azext-utils';
import { DirectoryTreeItem } from '../../tree/fileShare/DirectoryTreeItem';
import { IFileShareCreateChildContext } from '../../tree/fileShare/FileShareTreeItem';
import { deleteFilesAndDirectories } from '../deleteFilesAndDirectories';

export function registerDirectoryActionHandlers(): void {
    registerCommandWithTreeNodeUnwrapping("azureStorage.deleteDirectory", deleteFilesAndDirectories);
    registerCommandWithTreeNodeUnwrapping("azureStorage.createSubdirectory", async (context: IActionContext, treeItem: AzExtParentTreeItem) => await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: DirectoryTreeItem.contextValue }));

    // Note: azureStorage.createTextFile is registered in fileShareActionHandlers
}
