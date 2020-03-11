/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { ProgressLocation, Uri, window } from 'vscode';
import { AzureParentTreeItem, ICreateChildImplContext, parseError, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ext } from "../../extensionVariables";
import { localize } from "../../utils/localize";
import { nonNull } from "../../utils/storageWrappers";
import { IStorageRoot } from "../IStorageRoot";
import { TableTreeItem } from './TableTreeItem';

export class TableGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: azureStorage.TableService.ListTablesContinuationToken | undefined;

    public label: string = "Tables";
    public readonly childTypeLabel: string = "Table";
    public static contextValue: string = 'azureTableGroup';
    public contextValue: string = TableGroupTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureTable.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureTable.svg')
    };

    async loadMoreChildrenImpl(clearCache: boolean): Promise<TableTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let tables: azureStorage.TableService.ListTablesResponse;
        try {
            // currentToken argument typed incorrectly in SDK
            tables = await this.listTables(<azureStorage.TableService.ListTablesContinuationToken>this._continuationToken);
        } catch {
            throw new Error(localize('tableServiceNotActive', 'Table service is not currently active.'));
        }

        let { entries, continuationToken } = tables;
        this._continuationToken = continuationToken;

        return entries.map((table: string) => {
            return new TableTreeItem(
                this,
                table);
        });
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    listTables(currentToken: azureStorage.TableService.ListTablesContinuationToken): Promise<azureStorage.TableService.ListTablesResponse> {
        return new Promise((resolve, reject) => {
            let tableService = this.root.createTableService();
            tableService.listTablesSegmented(currentToken, { maxResults: maxPageSize }, (err?: Error, result?: azureStorage.TableService.ListTablesResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<TableTreeItem> {
        const tableName = await ext.ui.showInputBox({
            placeHolder: 'Enter a name for the new table',
            validateInput: TableGroupTreeItem.validateTableName
        });

        if (tableName) {
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                context.showCreatingTreeItem(tableName);
                progress.report({ message: `Azure Storage: Creating table '${tableName}'` });
                const table = await this.createTable(tableName);
                return new TableTreeItem(this, nonNull(table.TableName, "TableName"));
            });
        }

        throw new UserCancelledError();
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === TableTreeItem.contextValue;
    }

    private async createTable(name: string): Promise<azureStorage.TableService.TableResult> {
        return new Promise((resolve, reject) => {
            let tableService = this.root.createTableService();
            tableService.createTable(name, (err?: Error, result?: azureStorage.TableService.TableResult) => {
                if (err) {
                    if (parseError(err).errorType === "TableAlreadyExists") {
                        reject(new Error('The table specified already exists.'));
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(result);
                }
            });
        });
    }

    private static validateTableName(name: string): string | undefined | null {
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
}
