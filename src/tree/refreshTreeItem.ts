/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, IActionContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { WrappedResourceModel } from "../vscode-azureresourcegroups.api.v2";
import { AttachedAccountRoot } from "./AttachedStorageAccountsTreeItem";
import { IStorageTreeItem } from "./IStorageTreeItem";
import { branchDataProvider } from "./StorageAccountBranchDataProvider";
import { StorageAccountModel } from "./StorageAccountModel";

export async function refreshTreeItem(actionContext: IActionContext, node: (AzExtTreeItem & IStorageTreeItem) | WrappedResourceModel | undefined): Promise<void> {
    if (node) {
        if (node instanceof AzExtTreeItem) {
            node.root instanceof AttachedAccountRoot ?
                await ext.rgApi.workspaceResourceTree.refresh(actionContext, node) :
                await ext.rgApi.appResourceTree.refresh(actionContext, node);
        } else {
            const resourceModel = node.unwrap<StorageAccountModel>();

            if (resourceModel) {
                branchDataProvider.refresh(resourceModel);
            }
        }
    }
}
