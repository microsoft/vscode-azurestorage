/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureNode, registerCommand } from 'vscode-azureextensionui';
import { FileNode } from './fileNode';

export function registerFileActionHandlers(): void {
    registerCommand("azureStorage.deleteFile", async (node: IAzureNode<FileNode>) => await node.deleteNode());
}
