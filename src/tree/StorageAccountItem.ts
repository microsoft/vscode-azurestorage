import { StorageAccount, StorageManagementClient } from '@azure/arm-storage';
import { callWithTelemetryAndErrorHandling, IActionContext, ISubscriptionContext, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { createStorageClient } from '../utils/azureClients';
import { getResourceGroupFromId } from '../utils/azureUtils';
import { StorageAccountWrapper } from '../utils/storageWrappers';
import { ApplicationResource } from '../vscode-azureresourcegroups.api.v2';
import { BlobContainerGroupItem } from './blob/BlobContainerGroupItem';
import { StorageAccountModel } from './StorageAccountModel';

export class StorageAccountItem implements StorageAccountModel {
    constructor(private readonly resource: ApplicationResource) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return callWithTelemetryAndErrorHandling(
            'getChildren',
            async (context: IActionContext) => {
                const subContext: ISubscriptionContext = {
                    subscriptionDisplayName: '',
                    subscriptionPath: '',
                    tenantId: '',
                    userId: '',
                    ...this.resource.subscription
                };

                const storageManagementClient: StorageManagementClient = await createStorageClient([context, subContext]);
                const sa: StorageAccount = await storageManagementClient.storageAccounts.getProperties(getResourceGroupFromId(nonNullProp(this.resource, 'id')), nonNullProp(this.resource, 'name'));
                const wrapper = new StorageAccountWrapper(sa);
                const primaryEndpoints = wrapper.primaryEndpoints;
                const groupTreeItems: StorageAccountModel[] = [];

                if (primaryEndpoints.blob) {
                    groupTreeItems.push(new BlobContainerGroupItem());
                }

                /*
                if (primaryEndpoints.file) {
                    groupTreeItems.push(this._fileShareGroupTreeItem);
                }

                if (primaryEndpoints.queue) {
                    groupTreeItems.push(this._queueGroupTreeItem);
                }

                if (primaryEndpoints.table) {
                    groupTreeItems.push(this._tableGroupTreeItem);
                }
                */

                return groupTreeItems;
            });
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.resource.name, vscode.TreeItemCollapsibleState.Collapsed);

        return treeItem;
    }
}
