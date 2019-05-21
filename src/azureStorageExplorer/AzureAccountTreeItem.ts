/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureAccountTreeItemBase, ISubscriptionContext } from "vscode-azureextensionui";
import { SubscriptionTreeItem } from "./SubscriptionTreeItem";

export class AzureAccountTreeItem extends AzureAccountTreeItemBase {
    public createSubscriptionTreeItem(root: ISubscriptionContext): SubscriptionTreeItem {
        return new SubscriptionTreeItem(this, root);
    }
}
