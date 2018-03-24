/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureNode } from "vscode-azureextensionui";
import { BlobNode } from "./blobNode";

export function registerBlobActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.deleteBlob", (node: IAzureNode<BlobNode>) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.downloadBlob", (node: IAzureNode<BlobNode>) => node.treeItem.download(node));
}
