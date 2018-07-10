/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureParentNode, registerCommand } from 'vscode-azureextensionui';
import { TableGroupNode } from './tableGroupNode';

export function registerTableGroupActionHandlers(): void {
    registerCommand("azureStorage.createTable", async (node: IAzureParentNode<TableGroupNode>) => await node.createChild());
}
