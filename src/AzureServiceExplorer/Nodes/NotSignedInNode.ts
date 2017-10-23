import { AzureTreeDataProvider } from '../AzureTreeDataProvider';
import { TreeItemCollapsibleState, TreeItem } from 'vscode';
import { AzureTreeNodeBase } from './AzureTreeNodeBase';

export class NotSignedInNode extends AzureTreeNodeBase {
    private static readonly signInCommandString = "azure-account.login";
    constructor(treeDataProvider: AzureTreeDataProvider, parentNode?: AzureTreeNodeBase) {
        super('Sign in to Azure...', treeDataProvider, parentNode);
    }

    getTreeItem(): TreeItem {
        return {
            label: this.label,
            command: {
                title: this.label,
                command: NotSignedInNode.signInCommandString
            },
            collapsibleState: TreeItemCollapsibleState.None
        }
    }
}