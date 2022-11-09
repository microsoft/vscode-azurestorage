/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import { StorageAccountModel } from '../tree/StorageAccountModel';

export async function pickForDeleteNode<T extends StorageAccountModel>(_context: IActionContext, _expectedContextValue: string | RegExp, node?: T): Promise<T> {
    if (!node) {
        // node = await ext.rgApi.pickAppResource({ ...context, suppressCreatePick: true }, {
        //     filter: storageFilter,
        //     expectedChildContextValue: expectedContextValue
        // }) as T;

        // TODO: Enable picking.
        throw new Error('Not implemented');
    }

    return node;
}

export async function pickForCreateChildNode<T extends StorageAccountModel>(_context: IActionContext, _expectedContextValue: string, node?: T): Promise<T> {
    if (!node) {
        // node = await ext.rgApi.pickAppResource<AzExtParentTreeItem>(context, {
        //     filter: storageFilter,
        //     expectedChildContextValue: expectedContextValue
        // });

        // TODO: Enable picking.
        throw new Error('Not implemented');
    }

    return node;
}
