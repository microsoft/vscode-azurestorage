import * as vscode from 'vscode';
import { StorageWorkspaceModel } from './StorageWorkspaceModel';

export class AttachedStorageAccountsItem implements StorageWorkspaceModel {
    getChildren(): vscode.ProviderResult<StorageWorkspaceModel[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem('Attached Storage Accounts', vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'attachedStorageAccounts';
        treeItem.iconPath = new vscode.ThemeIcon('plug');

        return treeItem;
    }
}
