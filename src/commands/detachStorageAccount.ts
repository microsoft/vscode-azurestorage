/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { AttachedStorageAccountTreeItem } from "../tree/AttachedStorageAccountTreeItem";

export async function detachStorageAccount(actionContext: IActionContext, treeItem?: AttachedStorageAccountTreeItem): Promise<void> {
    if (!treeItem) {
        treeItem = <AttachedStorageAccountTreeItem>await ext.rgApi.workspaceResourceTree.showTreeItemPicker(AttachedStorageAccountTreeItem.baseContextValue, actionContext);
    }

    await ext.attachedStorageAccountsTreeItem.detach(treeItem);
    await ext.rgApi.workspaceResourceTree.refresh(actionContext, ext.attachedStorageAccountsTreeItem);
}
