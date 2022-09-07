import * as vscode from 'vscode';
import { BranchDataProvider, WorkspaceResource } from '../../vscode-azureresourcegroups.api.v2';
import { AttachedStorageAccountsItem } from './AttachedStorageAccountsItem';
import { StorageWorkspaceModel } from './StorageWorkspaceModel';

export class StorageWorkspaceBranchDataProvider extends vscode.Disposable implements BranchDataProvider<WorkspaceResource, StorageWorkspaceModel> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void | StorageWorkspaceModel | null | undefined>();

    constructor() {
        super(
            () => {
                this.onDidChangeTreeDataEmitter.dispose();
            });
    }

    onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

    getChildren(element: StorageWorkspaceModel): vscode.ProviderResult<StorageWorkspaceModel[]> {
        return element.getChildren();
    }

    getTreeItem(element: StorageWorkspaceModel): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    getResourceItem(_element: WorkspaceResource): StorageWorkspaceModel | Thenable<StorageWorkspaceModel> {
        return new AttachedStorageAccountsItem();
    }
}
