/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeDataProvider } from '../azureTreeDataProvider';
import { TreeItemCollapsibleState, TreeItem } from 'vscode';
import { AzureTreeNodeBase } from './azureTreeNodeBase';

export class LoadMoreNode extends AzureTreeNodeBase {
    constructor(treeDataProvider: AzureTreeDataProvider, parentNode: AzureTreeNodeBase, public readonly loadMore: () => {}) {
        super('Load More...', treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return { 
            label: this.label,
            contextValue: 'LoadMoreButton',
            collapsibleState: TreeItemCollapsibleState.None,
            command: {
                command: 'azureStorage.loadMoreNode',
                arguments: [this],
                title: ''
            } 
        }
    }
}