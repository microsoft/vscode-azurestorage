/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { QueueGroupTreeItem } from '../../tree/queue/QueueGroupTreeItem';
import { createChildNode } from '../commonTreeCommands';
import { isAzuriteCliInstalled, isAzuriteExtensionInstalled, warnAzuriteNotInstalled } from '../startEmulator';

export function registerQueueGroupActionHandlers(): void {
    registerCommand("azureStorage.createQueue", async (context: IActionContext, treeItem?: QueueGroupTreeItem) => {
        if (treeItem?.root.isEmulated && !isAzuriteExtensionInstalled() && !(await isAzuriteCliInstalled())) {
            warnAzuriteNotInstalled(context);
        }
        await createChildNode(context, QueueGroupTreeItem.contextValue, treeItem)
    });
}
