/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommand } from '@microsoft/vscode-azext-utils';
import { storageFilter } from '../../constants';
import { ext } from '../../extensionVariables';
import { AttachedStorageAccountsTreeItem } from '../../tree/AttachedStorageAccountsTreeItem';
import { QueueGroupTreeItem } from '../../tree/queue/QueueGroupTreeItem';
import { isAzuriteInstalled, warnAzuriteNotInstalled } from '../../utils/azuriteUtils';

export function registerQueueGroupActionHandlers(): void {
    registerCommand("azureStorage.createQueue", createQueue);
}

export async function createQueue(context: IActionContext, node?: QueueGroupTreeItem): Promise<void> {
    if (!node) {
        node = await ext.rgApi.pickAppResource<QueueGroupTreeItem>(context, {
            filter: storageFilter,
            expectedChildContextValue: QueueGroupTreeItem.contextValue,
            workspaceRootContextValue: AttachedStorageAccountsTreeItem.contextValue,
            expectedWorkspaceContextValue: QueueGroupTreeItem.contextValue
        });
    }

    if (node.root.isEmulated && !(await isAzuriteInstalled())) {
        warnAzuriteNotInstalled(context);
    }

    await node.createChild(context);
}
