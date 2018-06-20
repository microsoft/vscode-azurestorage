/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureNode } from "vscode-azureextensionui";
import { BlobNode } from "./blobNode";

export function registerBlobActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.deleteBlob", async (node: IAzureNode<BlobNode>) => await node.deleteNode());
    actionHandler.registerCommand("azureStorage.downloadBlob", async (node: IAzureNode<BlobNode>) => await node.treeItem.download(node));
}
