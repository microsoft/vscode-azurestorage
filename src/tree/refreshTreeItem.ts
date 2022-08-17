/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, IActionContext } from "@microsoft/vscode-azext-utils";
import { AttachedAccountRoot } from "../AttachedAccountRoot";
import { ext } from "../extensionVariables";
import { IStorageTreeItem } from "./IStorageTreeItem";

export async function refreshTreeItem(actionContext: IActionContext, node: (AzExtTreeItem & IStorageTreeItem) | undefined): Promise<void> {
    node && node.root instanceof AttachedAccountRoot ?
        await ext.rgApi.workspaceResourceTree.refresh(actionContext, node) :
        await ext.rgApi.appResourceTree.refresh(actionContext, node);
}
