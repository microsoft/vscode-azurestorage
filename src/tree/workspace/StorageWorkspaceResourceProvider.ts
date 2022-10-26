import * as vscode from 'vscode';
import { WorkspaceResource, WorkspaceResourceProvider } from '../../vscode-azureresourcegroups.api.v2';

export class StorageWorkspaceResourceProvider extends vscode.Disposable implements WorkspaceResourceProvider {
    private readonly onDidChangeResourceEmitter = new vscode.EventEmitter<WorkspaceResource | undefined>()


    constructor() {
        super(
            () => {
                this.onDidChangeResourceEmitter.dispose();
            });
    }

    onDidChangeResource = this.onDidChangeResourceEmitter.event;

    getResources(folder: vscode.WorkspaceFolder): vscode.ProviderResult<WorkspaceResource[]> {
        return [
            {
                folder,
                id: 'ms-azuretools.vscode-azurestorage', // TODO: Make unique?
                name: 'Attached Storage Accounts',
                resourceType: 'ms-azuretools.vscode-azurestorage'
            }
        ];
    }
}
