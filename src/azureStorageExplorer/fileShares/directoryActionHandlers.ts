/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureParentNode } from 'vscode-azureextensionui';
import { DirectoryNode } from './directoryNode';

export function registerDirectoryActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.deleteDirectory", async (node: IAzureParentNode) => await node.deleteNode());
    actionHandler.registerCommand("azureStorage.createSubdirectory", async (node: IAzureParentNode) => await node.createChild(DirectoryNode.contextValue));

    // Note: azureStorage.createTextFile is registered in fileShareActionHandlers
}
