/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { TableGroupTreeItem } from '../../tree/table/TableGroupTreeItem';
import { createChildNode } from '../commonTreeCommands';

export function registerTableGroupActionHandlers(): void {
    registerCommand("azureStorage.createTable", async (context: IActionContext, treeItem?: TableGroupTreeItem) => await createChildNode(context, TableGroupTreeItem.contextValue, treeItem));
}
