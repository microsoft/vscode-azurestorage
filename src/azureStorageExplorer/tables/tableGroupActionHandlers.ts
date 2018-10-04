/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from 'vscode-azureextensionui';
import { TableGroupTreeItem } from './tableGroupNode';

export function registerTableGroupActionHandlers(): void {
    registerCommand("azureStorage.createTable", async (treeItem: TableGroupTreeItem) => await treeItem.createChild());
}
