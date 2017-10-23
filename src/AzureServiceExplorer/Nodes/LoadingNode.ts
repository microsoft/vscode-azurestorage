import { AzureTreeDataProvider } from '../AzureTreeDataProvider';
import { TreeItemCollapsibleState, TreeItem } from 'vscode';
import { AzureTreeNodeBase } from './AzureTreeNodeBase';

export class LoadingNode extends AzureTreeNodeBase {
    constructor(treeDataProvider: AzureTreeDataProvider, parentNode?: AzureTreeNodeBase) {
        super('Loading...', treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}