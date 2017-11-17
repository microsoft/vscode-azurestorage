/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { AzureTreeDataProvider } from '../azureTreeDataProvider';

export class AzureTreeNodeBase {
    public label: string;

    protected constructor(label: string, readonly treeDataProvider: AzureTreeDataProvider, private readonly parentNode?: AzureTreeNodeBase) {
        this.label = label;
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        };
    }

    getParentNode<T extends AzureTreeNodeBase>(): T {
        return <T>this.parentNode;
    }

    async getChildren(): Promise<AzureTreeNodeBase[]> {
        return [];
    }

    openInPortal?(): void
}