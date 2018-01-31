/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureParentNode } from 'vscode-azureextensionui';
import { ChildKind } from './childKind';

export function RegisterDirectoryActionHandlers(actionHandler: AzureActionHandler) {
    actionHandler.registerCommand("azureStorage.deleteDirectory", (node: IAzureParentNode) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.createSubdirectory", (node: IAzureParentNode) => node.createChild(ChildKind.Subdirectory));
    actionHandler.registerCommand("azureStorage.createTextFile", (node: IAzureParentNode) => node.createChild(ChildKind.File));
}
