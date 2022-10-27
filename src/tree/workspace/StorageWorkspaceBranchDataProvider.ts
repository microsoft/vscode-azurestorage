import * as vscode from 'vscode';
import { WorkspaceResource, WorkspaceResourceBranchDataProvider } from '../../vscode-azureresourcegroups.api.v2';
import { createAttachedStorageAccountItemFactory } from '../AttachedStorageAccountItem';
import { AttachedStorageAccountsItem } from '../AttachedStorageAccountsItem';
import { StorageAccountModel } from '../StorageAccountModel';

export class StorageWorkspaceBranchDataProvider extends vscode.Disposable implements WorkspaceResourceBranchDataProvider<StorageAccountModel> {
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
        return new AttachedStorageAccountsItem(createAttachedStorageAccountItemFactory(model => this.onDidChangeTreeDataEmitter.fire(model)));
    }
}
