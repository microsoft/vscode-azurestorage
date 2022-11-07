import { StorageAccount, StorageManagementClient } from '@azure/arm-storage';
import { AzExtResourceType, callWithTelemetryAndErrorHandling, IActionContext, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { createStorageClient } from '../utils/azureClients';
import { getResourceGroupFromId } from '../utils/azureUtils';
import { StorageAccountWrapper } from '../utils/storageWrappers';
import { createSubscriptionContext } from '../utils/v2/credentialsUtils';
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
        return element.getChildren?.();
    }

    async getResourceItem(element: ApplicationResource): Promise<StorageAccountModel> {
        const resourceItem = await callWithTelemetryAndErrorHandling(
            'getResourceItem',
            async (context: IActionContext) => {
                const subContext = createSubscriptionContext(element.subscription);

                const storageManagementClient: StorageManagementClient = await createStorageClient([context, subContext]);
                const sa: StorageAccount = await storageManagementClient.storageAccounts.getProperties(getResourceGroupFromId(nonNullProp(element, 'id')), nonNullProp(element, 'name'));

                const storageAccount = new StorageAccountWrapper(sa);

                return new StorageAccountItem(element, storageAccount, storageManagementClient, model => this.refresh(model));
            });

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return resourceItem!;
    }

    getTreeItem(element: StorageAccountModel): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element.getTreeItem();
    }

    refresh(element: StorageAccountModel): void {
        this.onDidChangeTreeDataEmitter.fire(element);
    }
}

export const branchDataProvider = new StorageAccountBranchDataProvider();

