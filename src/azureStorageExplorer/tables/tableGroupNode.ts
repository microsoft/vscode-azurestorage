/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { ProgressLocation, Uri, window } from 'vscode';
import { AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from 'vscode-azureextensionui';
import { nonNull } from "../../components/storageWrappers";
import { resourcesPath } from "../../constants";
import { IStorageRoot } from "../IStorageRoot";
import { TableTreeItem } from './tableNode';

export class TableGroupTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationToken: azureStorage.TableService.ListTablesContinuationToken | undefined;

    public label: string = "Tables";
    public readonly childTypeLabel: string = "Table";
    public static contextValue: string = 'azureTableGroup';
    public contextValue: string = TableGroupTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(resourcesPath, 'light', 'AzureTable.svg'),
        dark: path.join(resourcesPath, 'dark', 'AzureTable.svg')
    };

    async loadMoreChildrenImpl(clearCache: boolean): Promise<TableTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        // currentToken argument typed incorrectly in SDK
        let containers = await this.listContainers(<azureStorage.TableService.ListTablesContinuationToken>this._continuationToken);
        let { entries, continuationToken } = containers;
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
    listContainers(currentToken: azureStorage.TableService.ListTablesContinuationToken): Promise<azureStorage.TableService.ListTablesResponse> {
        return new Promise((resolve, reject) => {
            let tableService = this.root.createTableService();
            tableService.listTablesSegmented(currentToken, { maxResults: 50 }, (err?: Error, result?: azureStorage.TableService.ListTablesResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<TableTreeItem> {
        const tableName = await window.showInputBox({
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

    // tslint:disable-next-line:promise-function-async // Grandfathered in
    private createTable(name: string): Promise<azureStorage.TableService.TableResult> {
        return new Promise((resolve, reject) => {
            let tableService = this.root.createTableService();
            tableService.createTable(name, (err?: Error, result?: azureStorage.TableService.TableResult) => {
                if (err) {
                    reject(err);
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
