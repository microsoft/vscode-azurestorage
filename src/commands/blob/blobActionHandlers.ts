/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from "@microsoft/vscode-azext-utils";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";

export function registerBlobActionHandlers(): void {
    registerCommand("azureStorage.deleteBlob", deleteBlob);
    registerCommand("azureStorage.deleteBlobDirectory", async (context: IActionContext, treeItem: BlobDirectoryTreeItem) => await treeItem.deleteTreeItem(context));
}

export async function deleteBlob(context: IActionContext, treeItem: BlobTreeItem): Promise<void> {
    await treeItem.deleteTreeItem(context);
}
