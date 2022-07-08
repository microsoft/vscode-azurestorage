import * as vscode from 'vscode';
import { ApplicationResource } from '../vscode-azureresourcegroups.api.v2';
import { StorageAccountModel } from './StorageAccountModel';

export class StorageAccountItem implements StorageAccountModel {
    constructor(private readonly resource: ApplicationResource) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        throw new Error('Method not implemented.');
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.resource.name);

        return treeItem;
    }
}
