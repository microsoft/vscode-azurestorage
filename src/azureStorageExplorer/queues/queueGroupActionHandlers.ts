/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler, IAzureParentNode } from 'vscode-azureextensionui';
import { QueueGroupNode } from './queueGroupNode';

export function registerQueueGroupActionHandlers(actionHandler: AzureActionHandler): void {
    actionHandler.registerCommand("azureStorage.createQueue", (node: IAzureParentNode<QueueGroupNode>) => node.createChild());
}
