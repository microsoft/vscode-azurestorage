/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureDataTables from '@azure/data-tables';
import { IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { TableGroupItem } from '../../tree/table/TableGroupItem';
import { listTables } from '../../tree/table/tableUtils';
import { registerBranchCommand } from '../../utils/v2/commandUtils';

export function registerTableGroupActionHandlers(): void {
    registerBranchCommand("azureStorage.createTable", createTable);
}

function validateTableName(name: string): string | undefined | null {
    const validLength = { min: 3, max: 36 };

    if (!name) {
        return "Table name cannot be empty";
    }
    if (name.indexOf(" ") >= 0) {
        return "Table name cannot contain spaces";
    }
    if (name.length < validLength.min || name.length > validLength.max) {
        return `Table name must contain between ${validLength.min} and ${validLength.max} characters`;
    }
    if (!/^[a-zA-Z0-9]+$/.test(name)) {
        return 'Table name can only contain letters and digits';
    }
    if (/(^[0-9])/.test(name)) {
        return 'Table name cannot begin with a digit';
    }

    return undefined;
}

export async function createTable(context: IActionContext, treeItem?: TableGroupItem): Promise<void> {
    if (!treeItem) {
        throw new Error('A tree item must be selected.');
    }

    const tableName = await context.ui.showInputBox({
        placeHolder: 'Enter a name for the new table',
        validateInput: validateTableName
    });

    if (tableName) {
        return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            progress.report({ message: `Azure Storage: Creating table '${tableName}'` });

            const tableServiceClient = treeItem.tableServiceClientFactory();
            await tableServiceClient.createTable(tableName);

            const tablesResponse = await listTables(treeItem.tableServiceClientFactory);
            let createdTable: azureDataTables.TableItem | undefined;
            for (const table of tablesResponse) {
                if (table.name === tableName) {
                    createdTable = table;
                    break;
                }
            }

            if (!createdTable) {
                throw new Error(`Could not create table "${tableName}".`);
            }

            treeItem.notifyCreated();
        });
    }

    throw new UserCancelledError();
}
