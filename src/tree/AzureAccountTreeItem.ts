/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureAccountTreeItemBase, IActionContext, ISubscriptionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { AttachedStorageAccountsTreeItem } from "./AttachedStorageAccountsTreeItem";
import { SubscriptionTreeItem } from "./SubscriptionTreeItem";

export class AzureAccountTreeItem extends AzureAccountTreeItemBase {
    private _isTestAccount: boolean;

    public constructor(testAccount?: {}) {
        super(undefined, testAccount);

        if (testAccount) {
            this._isTestAccount = true;
        } else {
            this._isTestAccount = false;
            ext.attachedStorageAccountsTreeItem = new AttachedStorageAccountsTreeItem(this);
        }
    }

    public createSubscriptionTreeItem(root: ISubscriptionContext): SubscriptionTreeItem {
        return new SubscriptionTreeItem(this, root);
    }

    public async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        const children: AzExtTreeItem[] = await super.loadMoreChildrenImpl(clearCache, context);

        if (!this._isTestAccount) {
            children.push(ext.attachedStorageAccountsTreeItem);
        }

        return children;
    }

    public compareChildrenImpl(item1: AzExtTreeItem, item2: AzExtTreeItem): number {
        if (item1 instanceof AttachedStorageAccountsTreeItem) {
            return 1;
        } else if (item2 instanceof AttachedStorageAccountsTreeItem) {
            return -1;
        } else {
            return super.compareChildrenImpl(item1, item2);
        }
    }
}
