/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from '@microsoft/vscode-azext-utils';
import { TableGroupTreeItem } from '../../tree/table/TableGroupTreeItem';
import { createChildNode } from '../commonTreeCommands';

export function registerTableGroupActionHandlers(): void {
    registerCommand("azureStorage.createTable", createTable);
}

export async function createTable(context: IActionContext, treeItem?: TableGroupTreeItem): Promise<void> {
    await createChildNode(context, TableGroupTreeItem.contextValue, treeItem);
}
