/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureParentNode } from 'vscode-azureextensionui';
import { DirectoryNode } from './directoryNode';
import { FileNode } from './fileNode';

export function RegisterDirectoryActionHandlers(actionHandler: AzureActionHandler) {
    actionHandler.registerCommand("azureStorage.deleteDirectory", (node: IAzureParentNode) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.createSubdirectory", (node: IAzureParentNode) => node.createChild(DirectoryNode.contextValue));

    // Note: azureStorage.createTextFile is registered in fileShareActionHandlers
}
