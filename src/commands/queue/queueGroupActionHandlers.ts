/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommandWithTreeNodeUnwrapping } from '@microsoft/vscode-azext-utils';
import { QueueGroupTreeItem } from '../../tree/queue/QueueGroupTreeItem';
import { isAzuriteInstalled, warnAzuriteNotInstalled } from '../../utils/azuriteUtils';
import { createChildNode } from '../commonTreeCommands';

export function registerQueueGroupActionHandlers(): void {
    registerCommandWithTreeNodeUnwrapping("azureStorage.createQueue", createQueue);
}

export async function createQueue(context: IActionContext, treeItem?: QueueGroupTreeItem): Promise<void> {
    if (treeItem?.root.isEmulated && !(await isAzuriteInstalled())) {
        warnAzuriteNotInstalled(context);
    }
    await createChildNode(context, QueueGroupTreeItem.contextValue, treeItem);
}
