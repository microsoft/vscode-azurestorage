/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, IActionContext } from '@microsoft/vscode-azext-utils';
import { storageFilter } from '../constants';
import { ext } from '../extensionVariables';

export async function deleteNode(context: IActionContext, expectedContextValue?: string | RegExp, node?: AzExtTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource({ ...context, suppressCreatePick: true }, {
            filter: storageFilter,
            expectedChildContextValue: expectedContextValue
        });
    }

    await node.deleteTreeItem(context);
}

export async function createChildNode(context: IActionContext, expectedContextValue: string, node?: AzExtParentTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<AzExtParentTreeItem>(context, {
            filter: storageFilter,
            expectedChildContextValue: expectedContextValue
        });
    }

    await node.createChild(context);
}
