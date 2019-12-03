/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, ICreateChildImplContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';

export async function createStorageAccount(context: IActionContext & Partial<ICreateChildImplContext>, treeItem?: SubscriptionTreeItem): Promise<void> {
    if (!treeItem) {
        treeItem = <SubscriptionTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue, context);
    }

    await treeItem.createChild(context);
}

export async function createStorageAccountAdvanced(actionContext: IActionContext, treeItem?: SubscriptionTreeItem): Promise<void> {
    await createStorageAccount({ ...actionContext, advancedCreation: true }, treeItem);
}
