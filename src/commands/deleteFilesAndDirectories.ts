/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { BlobContainerGroupTreeItem } from "../tree/blob/BlobContainerGroupTreeItem";
import { FileShareGroupTreeItem } from "../tree/fileShare/FileShareGroupTreeItem";
import { isTreeItemDirectory } from "../utils/directoryUtils";
import { isSubpath } from "../utils/fs";
import { treeUtils } from "../utils/treeUtils";

export async function deleteFilesAndDirectories(context: IActionContext, treeItem: AzExtTreeItem, selection: AzExtTreeItem[] = []): Promise<void> {
    const parentContainer = treeUtils.findNearestParent<BlobContainerGroupTreeItem | FileShareGroupTreeItem>(treeItem, [
        BlobContainerGroupTreeItem.contextValue,
        FileShareGroupTreeItem.contextValue
    ]);

    // Covers both single selection and an edge case where the node you delete from isn't part of the selection
    if (!selection.some(s => s === treeItem)) {
        await ext.rgApi.appResourceTreeView.reveal(treeItem);
        await treeItem.deleteTreeItem(context);
        await parentContainer.refresh(context);
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
    await parentContainer.refresh(context);
}
