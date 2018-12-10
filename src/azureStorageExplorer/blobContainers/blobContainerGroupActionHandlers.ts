/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from 'vscode-azureextensionui';
import { createChildNode } from '../commonTreeCommands';
import { BlobContainerGroupTreeItem } from './blobContainerGroupNode';

export function registerBlobContainerGroupActionHandlers(): void {
    registerCommand("azureStorage.createBlobContainer", async (treeItem?: BlobContainerGroupTreeItem) => await createChildNode(BlobContainerGroupTreeItem.contextValue, treeItem));
}
