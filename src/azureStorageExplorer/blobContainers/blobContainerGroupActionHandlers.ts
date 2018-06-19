/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureParentNode } from 'vscode-azureextensionui';
import { BlobContainerGroupNode } from './blobContainerGroupNode';

export function registerBlobContainerGroupActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.createBlobContainer", (node: IAzureParentNode<BlobContainerGroupNode>) => node.createChild());
}
