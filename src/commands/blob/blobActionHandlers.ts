/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from "@microsoft/vscode-azext-utils";
import { ext } from "../../extensionVariables";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";
import { isTreeItemDirectory } from "../../utils/directoryUtils";
import { isSubpath } from "../../utils/fs";

export function registerBlobActionHandlers(): void {
    registerCommand("azureStorage.deleteBlob", deleteBlob);
}

export async function deleteBlob(context: IActionContext, treeItem: BlobTreeItem | BlobDirectoryTreeItem, selection: (BlobTreeItem | BlobDirectoryTreeItem)[] = []): Promise<void> {
    // Covers both single selection and an edge case where the node you delete from isn't part of the selection
    if (!selection.some(s => s === treeItem)) {
        await ext.rgApi.appResourceTreeView.reveal(treeItem);
        await treeItem.deleteTreeItem(context);
        return;
    }

    const dirPaths: string[] = [];
    let shouldSkip;
    for (const node of selection) {
        shouldSkip = false;

        // Check to see if it's a resource we've already deleted
        for (const dirPath of dirPaths) {
            if (isSubpath(dirPath, node.fullId)) {
                shouldSkip = true;
                break;
            }
        }
        if (shouldSkip) continue;
        if (isTreeItemDirectory(node)) {
            dirPaths.push(node.fullId);
        }
        await node.deleteTreeItem(context);
    }
}
