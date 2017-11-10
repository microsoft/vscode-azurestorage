/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { TableNode } from './tableNode';
import { SubscriptionModels } from 'azure-arm-resource';
import * as azureStorage from "azure-storage";
import * as path from 'path';

export class TableGroupNode extends AzureTreeNodeBase {
    constructor(
        public readonly subscription: SubscriptionModels.Subscription, 
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super("Tables", treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.Collapsed,
            contextValue: 'azureTableGroup',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureTable_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureTable_16x.png')
			}
        }
    }

    async getChildren(): Promise<any> {
        var containers = await this.listContainers(null);
        var {entries /*, continuationToken*/} = containers;

        return entries.map((table: string) => {
            return new TableNode(
                this.subscription,
                table, 
                this.storageAccount, 
                this.key, 
                this.getTreeDataProvider(), 
                this);
        });

    }

    listContainers(currentToken: azureStorage.TableService.ListTablesContinuationToken): Promise<azureStorage.TableService.ListTablesResponse> {
        return new Promise(resolve => {
            var tableService = azureStorage.createTableService(this.storageAccount.name, this.key.value);
			tableService.listTablesSegmented(currentToken, {maxResults: 5}, (_err, result: azureStorage.TableService.ListTablesResponse) => {
				resolve(result);
			})
		});
    }
}
