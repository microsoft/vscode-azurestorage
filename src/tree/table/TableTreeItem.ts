/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Uri } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from '../../constants';
import { IStorageRoot } from "../IStorageRoot";

export class TableTreeItem extends AzureTreeItem<IStorageRoot> {
    constructor(
        parent: AzureParentTreeItem,
        public readonly tableName: string) {
        super(parent);
    }

    public label: string = this.tableName;
    public static contextValue: string = 'azureTable';
    public contextValue: string = TableTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureTable.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureTable.svg')
    };

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
