/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WrappedResourceModel } from "../vscode-azureresourcegroups.api.v2";
import { branchDataProvider } from "./StorageAccountBranchDataProvider";
import { StorageAccountModel } from "./StorageAccountModel";

export async function refreshTreeItem(node: WrappedResourceModel | undefined): Promise<void> {
    if (node) {
        const resourceModel = node.unwrap<StorageAccountModel>();

        if (resourceModel) {
            branchDataProvider.refresh(resourceModel);
        }
    }
}
