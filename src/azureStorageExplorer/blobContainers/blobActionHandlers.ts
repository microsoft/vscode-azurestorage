/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureNode, registerCommand } from "vscode-azureextensionui";
import { BlobNode } from "./blobNode";

export function registerBlobActionHandlers(): void {
    registerCommand("azureStorage.deleteBlob", async (node: IAzureNode<BlobNode>) => await node.deleteNode());
    registerCommand("azureStorage.downloadBlob", async (node: IAzureNode<BlobNode>) => await node.treeItem.download(node));
}
