/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { TableNode } from './tableNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureParentTreeItem, IAzureNode } from 'vscode-azureextensionui';

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
}
