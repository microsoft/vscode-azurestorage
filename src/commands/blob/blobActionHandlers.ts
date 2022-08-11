/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from "@microsoft/vscode-azext-utils";
import { ext } from "../../extensionVariables";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";

export function registerBlobActionHandlers(): void {
    registerCommand("azureStorage.deleteBlob", deleteBlob);
}

export async function deleteBlob(context: IActionContext, treeItem: BlobTreeItem | BlobDirectoryTreeItem): Promise<void> {
    const { selection } = ext.rgApi.appResourceTreeView;

    // Covers both single selection and an edge case where the node you delete from isn't part of the selection
    if (!selection.some(s => s === treeItem)) {
        await ext.rgApi.appResourceTreeView.reveal(treeItem);
        await treeItem.deleteTreeItem(context);
        return;
    }

    for (const node of selection) {
        await node.deleteTreeItem(context);
    }
}
