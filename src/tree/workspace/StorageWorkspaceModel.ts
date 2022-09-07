import * as vscode from 'vscode';
import { ResourceModelBase } from '../../vscode-azureresourcegroups.api.v2';

export interface StorageWorkspaceModel extends ResourceModelBase {
    getChildren(): vscode.ProviderResult<StorageWorkspaceModel[]>;
    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}
