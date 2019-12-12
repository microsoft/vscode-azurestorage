/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from "vscode-azureextensionui";
import { BlobTreeItem } from "./BlobTreeItem";

export function registerBlobActionHandlers(): void {
    registerCommand("azureStorage.deleteBlob", async (context: IActionContext, treeItem: BlobTreeItem) => await treeItem.deleteTreeItem(context));
    registerCommand("azureStorage.downloadBlob", async (_context: IActionContext, treeItem: BlobTreeItem) => await treeItem.download());
}
