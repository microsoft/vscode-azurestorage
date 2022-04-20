/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, IActionContext } from '@microsoft/vscode-azext-utils';
import { ext } from '../extensionVariables';

export async function deleteNode(context: IActionContext, expectedContextValue: string | RegExp, node?: AzExtTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.tree.showTreeItemPicker<AzExtTreeItem>(expectedContextValue, { ...context, suppressCreatePick: true });
    }

    await node.deleteTreeItem(context);
}

export async function createChildNode(context: IActionContext, expectedContextValue: string, node?: AzExtParentTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.tree.showTreeItemPicker<AzExtParentTreeItem>(expectedContextValue, context);
    }

    await node.createChild(context);
}
