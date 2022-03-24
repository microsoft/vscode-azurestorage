/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureDataTables from '@azure/data-tables';
import { AzExtParentTreeItem, ICreateChildImplContext, parseError, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { ResolvedAppResourceTreeItem } from '../../api';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ResolvedStorageAccount } from '../../StorageAccountResolver';
import { localize } from "../../utils/localize";
import { nonNull } from '../../utils/storageWrappers';
import { AttachedStorageAccountTreeItem } from "../AttachedStorageAccountTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { TableTreeItem } from './TableTreeItem';

export class TableGroupTreeItem extends AzExtParentTreeItem {
    private _continuationToken: string | undefined;

    public label: string = "Tables";
    public readonly childTypeLabel: string = "Table";
    public static contextValue: string = 'azureTableGroup';
    public contextValue: string = TableGroupTreeItem.contextValue;
    public parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem;

    public constructor(parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem) {
        super(parent);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureTable.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureTable.svg')
        };
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<TableTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let tablesResponse: azureDataTables.TableItemResultPage;
        try {
            tablesResponse = await this.listTables(this._continuationToken);
        } catch (error) {
            if (parseError(error).errorType === 'NotImplemented') {
                throw new Error(localize('storageAccountDoesNotSupportTables', 'This storage account does not support tables.'));
            } else {
                throw error;
            }
        }

        this._continuationToken = tablesResponse.continuationToken;

        return tablesResponse
            .filter(tableItem => tableItem.name !== undefined)
            .map((tableItem) => {
                return new TableTreeItem(this, tableItem.name as string);
            });
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async listTables(continuationToken?: string): Promise<azureDataTables.TableItemResultPage> {
        const tableServiceClient = this.root.createTableServiceClient();
        const response: AsyncIterableIterator<azureDataTables.TableItemResultPage> = tableServiceClient.listTables().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<TableTreeItem> {
        const tableName = await context.ui.showInputBox({
            placeHolder: 'Enter a name for the new table',
            validateInput: TableGroupTreeItem.validateTableName
        });

        if (tableName) {
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                context.showCreatingTreeItem(tableName);
                progress.report({ message: `Azure Storage: Creating table '${tableName}'` });
                const table = await this.createTable(tableName);
                return new TableTreeItem(this, nonNull(table.name, 'name'));
            });
        }

        throw new UserCancelledError();
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === TableTreeItem.contextValue;
    }

    private async createTable(name: string): Promise<azureDataTables.TableItem> {
        const tableServiceClient = this.root.createTableServiceClient();
        await tableServiceClient.createTable(name);

        const tablesResponse = await this.listTables();
        let createdTable: azureDataTables.TableItem | undefined;
        for (const table of tablesResponse) {
            if (table.name === name) {
                createdTable = table;
                break;
            }
        }

        if (!createdTable) {
            throw new Error(`Could not create table "${name}".`);
        }

        return createdTable;
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
