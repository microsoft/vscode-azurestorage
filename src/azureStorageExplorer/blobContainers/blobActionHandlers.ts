/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from "vscode-azureextensionui";
import { BlobTreeItem } from "./blobNode";

export function registerBlobActionHandlers(): void {
    registerCommand("azureStorage.deleteBlob", async (treeItem: BlobTreeItem) => await treeItem.deleteTreeItem());
    registerCommand("azureStorage.downloadBlob", async (treeItem: BlobTreeItem) => await treeItem.download());
}
