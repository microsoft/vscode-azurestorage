/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzureParentNode, registerCommand } from 'vscode-azureextensionui';
import { QueueGroupNode } from './queueGroupNode';

export function registerQueueGroupActionHandlers(): void {
    registerCommand("azureStorage.createQueue", async (node: IAzureParentNode<QueueGroupNode>) => await node.createChild());
}
