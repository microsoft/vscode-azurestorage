import * as vscode from 'vscode';
import { ApplicationResource, BranchDataProvider } from '../vscode-azureresourcegroups.api.v2';
import { StorageAccountItem } from './StorageAccountItem';
import { StorageAccountModel } from './StorageAccountModel';

export class StorageAccountBranchDataProvider extends vscode.Disposable implements BranchDataProvider<ApplicationResource, StorageAccountModel> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<StorageAccountModel>();

    constructor() {
        super(
            () => {
                this.onDidChangeTreeDataEmitter.dispose();
            });
    }

    get onDidChangeTreeData(): vscode.Event<StorageAccountModel> {
        return this.onDidChangeTreeDataEmitter.event;
    }

    getChildren(element: StorageAccountModel): vscode.ProviderResult<StorageAccountModel[]> {
        return element.getChildren();
    }

    getResourceItem(element: ApplicationResource): StorageAccountModel | Thenable<StorageAccountModel> {
        return new StorageAccountItem(element);
    }

    getTreeItem(element: StorageAccountModel): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }
}
