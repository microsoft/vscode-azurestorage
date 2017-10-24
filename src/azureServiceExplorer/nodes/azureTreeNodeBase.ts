/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';

export class AzureTreeNodeBase {
    public label: string;

    protected constructor(label: string, private readonly treeDataProvider: TreeDataProvider<AzureTreeNodeBase>, private readonly parentNode?: AzureTreeNodeBase) {
        this.label = label;
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        };
    }

    getTreeDataProvider<T extends TreeDataProvider<AzureTreeNodeBase>>(): T {
        return <T>this.treeDataProvider;
    }

    getParentNode<T extends AzureTreeNodeBase>(): T {
        return <T>this.parentNode;
    }

    async getChildren(): Promise<AzureTreeNodeBase[]> {
        return [];
    }

    openInPortal?(): void
}