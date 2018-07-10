/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureParentNode, registerCommand } from 'vscode-azureextensionui';
import { BlobContainerGroupNode } from './blobContainerGroupNode';

export function registerBlobContainerGroupActionHandlers(): void {
    registerCommand("azureStorage.createBlobContainer", async (node: IAzureParentNode<BlobContainerGroupNode>) => await node.createChild());
}
