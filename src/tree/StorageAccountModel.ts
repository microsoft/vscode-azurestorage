import * as vscode from 'vscode';
import { ResourceModelBase } from "../vscode-azureresourcegroups.api.v2";

export interface StorageAccountModel extends ResourceModelBase {
    getChildren(): vscode.ProviderResult<StorageAccountModel[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}
