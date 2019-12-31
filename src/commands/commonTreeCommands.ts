/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';

export async function deleteNode(context: IActionContext, expectedContextValue: string, node?: AzExtTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker(expectedContextValue, { ...context, suppressCreatePick: true });
    }

    await node.deleteTreeItem(context);
}

export async function createChildNode(context: IActionContext, expectedContextValue: string, node?: AzExtParentTreeItem): Promise<void> {
    if (!node) {
        node = await ext.tree.showTreeItemPicker<AzExtParentTreeItem>(expectedContextValue, context);
    }

    await node.createChild(context);
}
