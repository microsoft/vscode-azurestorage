/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { AzExtTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from '../../constants';
import { IStorageRoot } from '../IStorageRoot';
import { TableGroupTreeItem } from './TableGroupTreeItem';

export class TableTreeItem extends AzExtTreeItem {
    public parent: TableGroupTreeItem;
    constructor(
        parent: TableGroupTreeItem,
        public readonly tableName: string) {
        super(parent);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureTable.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureTable.svg')
        };
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public label: string = this.tableName;
    public static contextValue: string = 'azureTable';
    public contextValue: string = TableTreeItem.contextValue;

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const message: string = `Are you sure you want to delete table '${this.label}' and all its contents?`;
        const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const tableService = this.root.createTableService();
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tableService.deleteTable(this.tableName, (err?: any) => {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }
}
