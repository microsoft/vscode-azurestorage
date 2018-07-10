/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureParentNode, registerCommand } from 'vscode-azureextensionui';
import { FileShareGroupNode } from './fileShareGroupNode';

export function registerFileShareGroupActionHandlers(): void {
    registerCommand("azureStorage.createFileShare", async (node: IAzureParentNode<FileShareGroupNode>) => await node.createChild());
}
