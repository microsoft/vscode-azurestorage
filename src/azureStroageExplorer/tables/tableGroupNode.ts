/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, ProgressLocation, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { TableNode } from './tableNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureParentTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';

export class TableGroupNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.TableService.ListTablesContinuationToken;

    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public id: string = undefined;
    public label: string = "Tables";
    public contextValue: string = 'azureTableGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureTable_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureTable_16x.png')
    };

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        var containers = await this.listContainers(this._continuationToken);
        var { entries, continuationToken } = containers;
        this._continuationToken = continuationToken;

        return entries.map((table: string) => {
            return new TableNode(
                table,
                this.storageAccount,
                this.key);
        });

    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    listContainers(currentToken: azureStorage.TableService.ListTablesContinuationToken): Promise<azureStorage.TableService.ListTablesResponse> {
        return new Promise((resolve, reject) => {
            var tableService = azureStorage.createTableService(this.storageAccount.name, this.key.value);
            tableService.listTablesSegmented(currentToken, { maxResults: 50 }, (err: Error, result: azureStorage.TableService.ListTablesResponse) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            })
        });
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const tableName = await window.showInputBox({
            placeHolder: `Enter a name for the new table`,
            validateInput: TableGroupNode.validateTableName
        });

        if (tableName) {
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                showCreatingNode(tableName);
                progress.report({ message: `Azure Storage: Creating table '${tableName}'` });
                const table = await this.createTable(tableName);
                return new TableNode(table.TableName, this.storageAccount, this.key);
            });
        }

        throw new UserCancelledError();
    }

    private createTable(name: string): Promise<azureStorage.TableService.TableResult> {
        return new Promise((resolve, reject) => {
            var tableService = azureStorage.createTableService(this.storageAccount.name, this.key.value);
            tableService.createTable(name, (err: Error, result: azureStorage.TableService.TableResult) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    private static validateTableName(name: string): string | undefined | null {
        if (!name) {
            return "Table name cannot be empty";
        }
        if (name.indexOf(" ") >= 0) {
            return "Table name cannot contain spaces";
        }

        if (name.length < 3 || name.length > 36) {
            return 'Table name must contain between 3 and 36 characters';
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
