import { AzExtResourceType } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ApplicationResource, ApplicationResourceBranchDataProvider } from '../vscode-azureresourcegroups.api.v2';
import { StorageAccountItem } from './StorageAccountItem';
import { StorageAccountModel } from './StorageAccountModel';

export class StorageAccountBranchDataProvider extends vscode.Disposable implements ApplicationResourceBranchDataProvider<StorageAccountModel> {
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

    findModel<T>(_resourceType: AzExtResourceType, _resourceId: string, _context?: string[] | undefined): vscode.ProviderResult<T> {
        return undefined;
    }

    getChildren(element: StorageAccountModel): vscode.ProviderResult<StorageAccountModel[]> {
        return element.getChildren();
    }

    getResourceItem(element: ApplicationResource): StorageAccountModel | Thenable<StorageAccountModel> {
        return new StorageAccountItem(element, model => this.refresh(model));
    }

    getTreeItem(element: StorageAccountModel): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    refresh(element: StorageAccountModel): void {
        this.onDidChangeTreeDataEmitter.fire(element);
    }
}

export const branchDataProvider = new StorageAccountBranchDataProvider();

