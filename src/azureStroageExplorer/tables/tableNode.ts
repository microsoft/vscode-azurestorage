/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
import { SubscriptionModels } from 'azure-arm-resource';
import * as path from 'path';

export class TableNode extends AzureTreeNodeBase {
    constructor(
        public readonly subscription: SubscriptionModels.Subscription, 
		public readonly tableName: string,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey,
		treeDataProvider: AzureTreeDataProvider, 
        parentNode: AzureTreeNodeBase) {
		super(tableName, treeDataProvider, parentNode);
		
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None,
            contextValue: 'azureTable',
            iconPath: {
				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureTable_16x.png'),
				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureTable_16x.png')
			}
        }
    }
}
