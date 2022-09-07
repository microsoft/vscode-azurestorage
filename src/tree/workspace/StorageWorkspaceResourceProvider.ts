import * as vscode from 'vscode';
import { ProvideResourceOptions, WorkspaceResource, WorkspaceResourceProvider } from '../../vscode-azureresourcegroups.api.v2';

export class StorageWorkspaceResourceProvider extends vscode.Disposable implements WorkspaceResourceProvider {
    private readonly onDidChangeResourceEmitter = new vscode.EventEmitter<WorkspaceResource | undefined>()


    constructor() {
        super(
            () => {
                this.onDidChangeResourceEmitter.dispose();
            });
    }

    onDidChangeResource = this.onDidChangeResourceEmitter.event;

    provideResources(folder: vscode.WorkspaceFolder, _options?: ProvideResourceOptions | undefined): vscode.ProviderResult<WorkspaceResource[]> {
        return [
            {
                folder,
                id: 'ms-azuretools.vscode-azurestorage', // TODO: Make unique?
                name: 'Attached Storage Accounts',
                type: 'ms-azuretools.vscode-azurestorage'
            }
        ];
    }
}
