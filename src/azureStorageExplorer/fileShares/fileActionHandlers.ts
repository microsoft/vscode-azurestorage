/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureNode } from 'vscode-azureextensionui';
import { FileNode } from './fileNode';

export function registerFileActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.deleteFile", (node: IAzureNode<FileNode>) => node.deleteNode());
}
