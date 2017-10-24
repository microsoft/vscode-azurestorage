/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeDataProvider } from '../AzureTreeDataProvider';
import { TreeItemCollapsibleState, TreeItem } from 'vscode';
import { AzureTreeNodeBase } from './AzureTreeNodeBase';

export class SelectSubscriptionsNode extends AzureTreeNodeBase {
    constructor(treeDataProvider: AzureTreeDataProvider, parentNode?: AzureTreeNodeBase) {
        super('Select Subscriptions...', treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            command: {
                title: this.label,
                command: 'azure-account.selectSubscriptions'
            },
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}