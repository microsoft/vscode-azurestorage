/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TableItem, TableItemResultPage } from '@azure/data-tables';

import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, ICreateChildImplContext, nonNullProp, parseError, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { ResolvedAppResourceTreeItem } from '@microsoft/vscode-azext-utils/hostapi';
import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { getResourcesPath, maxPageSize } from "../../constants";
import { ResolvedStorageAccount } from '../../StorageAccountResolver';
import { localize } from "../../utils/localize";
import { AttachedStorageAccountTreeItem } from "../AttachedStorageAccountTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { IStorageTreeItem } from '../IStorageTreeItem';
import { TableTreeItem } from './TableTreeItem';

export class TableGroupTreeItem extends AzExtParentTreeItem implements IStorageTreeItem {
    private _continuationToken: string | undefined;

    public label: string = "Tables";
    public readonly childTypeLabel: string = "Table";
    public static contextValue: string = 'azureTableGroup';
    public contextValue: string = TableGroupTreeItem.contextValue;
    public declare parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem;

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

    async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let tablesResponse: TableItemResultPage;
        try {
            tablesResponse = await this.listTables(this._continuationToken);
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (errorType === 'NotImplemented') {
                throw new Error(localize('storageAccountDoesNotSupportTables', 'This storage account does not support tables.'));
            } else if (this.root.isEmulated && errorType === 'ECONNREFUSED') {
                return [new GenericTreeItem(this, {
                    contextValue: 'startTableEmulator',
                    label: 'Start Table Emulator',
                    commandId: 'azureStorage.startTableEmulator',
                    includeInTreeItemPicker: false
                })];
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

    async listTables(continuationToken?: string): Promise<TableItemResultPage> {
        const tableServiceClient = await this.root.createTableServiceClient();
        const response: AsyncIterableIterator<TableItemResultPage> = tableServiceClient.listTables().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<TableTreeItem> {
        const tableName = await context.ui.showInputBox({
            placeHolder: 'Enter a name for the new table',
            validateInput: TableGroupTreeItem.validateTableName
        });

        if (tableName) {
            const currentChildren = await this.getCachedChildren(context);
            if (currentChildren.some(child => child.label === tableName)) {
                throw new Error(localize('tableAlreadyExists', 'The table "{0}" already exists', tableName));
            }
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                context.showCreatingTreeItem(tableName);
                progress.report({ message: `Azure Storage: Creating table '${tableName}'` });
                const table = await this.createTable(tableName);
                return new TableTreeItem(this, nonNullProp(table, 'name'));
            });
        }

        throw new UserCancelledError();
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === TableTreeItem.contextValue;
    }

    private async createTable(name: string): Promise<TableItem> {
        const tableServiceClient = await this.root.createTableServiceClient();
        await tableServiceClient.createTable(name);

        const tablesResponse = await this.listTables();
        let createdTable: TableItem | undefined;
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
