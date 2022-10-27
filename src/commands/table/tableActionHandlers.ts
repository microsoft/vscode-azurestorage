/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogResponses, IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { TableItem } from '../../tree/table/TableItem';
import { registerBranchCommand } from '../../utils/v2/commandUtils';

export function registerTableActionHandlers(): void {
    registerBranchCommand("azureStorage.openTable", openTableInStorageExplorer);
    registerBranchCommand("azureStorage.deleteTable", deleteTable);
}

async function openTableInStorageExplorer(_context: IActionContext, treeItem: TableItem): Promise<void> {
    const accountId = treeItem.storageRoot.storageAccountId;
    const resourceType = "Azure.Table";
    const resourceName = treeItem.tableName;

    await storageExplorerLauncher.openResource(accountId, treeItem.subscriptionId, resourceType, resourceName);
}

export async function deleteTable(context: IActionContext, treeItem?: TableItem): Promise<void> {
    if (!treeItem) {
        throw new Error('A tree item must be selected.');
    }

    const message: string = `Are you sure you want to delete table '${treeItem.tableName}' and all its contents?`;
    const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    if (result === DialogResponses.deleteResponse) {
        const tableServiceClient = treeItem.storageRoot.createTableServiceClient();
        await tableServiceClient.deleteTable(treeItem.tableName);
        treeItem.notifyDeleted();
    } else {
        throw new UserCancelledError();
    }
}
