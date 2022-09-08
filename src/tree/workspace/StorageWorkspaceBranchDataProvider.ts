import * as vscode from 'vscode';
import { BranchDataProvider, WorkspaceResource } from '../../vscode-azureresourcegroups.api.v2';
import { StorageAccountModel } from '../StorageAccountModel';
import { AttachedStorageAccountsItem } from '../AttachedStorageAccountsItem';

export class StorageWorkspaceBranchDataProvider extends vscode.Disposable implements BranchDataProvider<WorkspaceResource, StorageAccountModel> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void | StorageAccountModel | null | undefined>();

    constructor() {
        super(
            () => {
                this.onDidChangeTreeDataEmitter.dispose();
            });
    }

    onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

    getChildren(element: StorageAccountModel): vscode.ProviderResult<StorageAccountModel[]> {
        return element.getChildren();
    }

    getTreeItem(element: StorageAccountModel): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getResourceItem(_element: WorkspaceResource): StorageAccountModel | Thenable<StorageAccountModel> {
        return new AttachedStorageAccountsItem();
    }
}
