import * as vscode from 'vscode';
import { VisitedResourceModel } from '../utils/v2/treeutils';
import { ResourceModelBase } from '../vscode-azureresourcegroups.api.v2';

// TODO: Do we need our own interface?
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface StorageAccountModel extends VisitedResourceModel, ResourceModelBase {
    readonly copyUrl?: vscode.Uri;
}
