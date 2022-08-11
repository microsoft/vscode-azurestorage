import * as azureStorageBlob from "@azure/storage-blob";
import * as azureStorageQueue from '@azure/storage-queue';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureDataTables from '@azure/data-tables';
import { StorageAccount, StorageAccountKey, StorageManagementClient } from '@azure/arm-storage';
import { callWithTelemetryAndErrorHandling, IActionContext, nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { createStorageClient } from '../utils/azureClients';
import { getResourceGroupFromId } from '../utils/azureUtils';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from '../utils/storageWrappers';
import { ApplicationResource } from '../vscode-azureresourcegroups.api.v2';
import { BlobContainerGroupItem } from './blob/BlobContainerGroupItem';
import { FileShareGroupItem } from './fileShare/FileShareGroupItem';
import { QueueGroupItem } from './queue/QueueGroupItem';
import { StorageAccountModel } from './StorageAccountModel';
import { TableGroupItem } from './table/TableGroupItem';
import { createSubscriptionContext } from "../utils/v2/credentialsUtils";

export type WebSiteHostingStatus = {
    capable: boolean;
    enabled: boolean;
    indexDocument?: string;
    errorDocument404Path?: string;
};

export class StorageAccountItem implements StorageAccountModel {
    constructor(private readonly resource: ApplicationResource) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return callWithTelemetryAndErrorHandling(
            'getChildren',
            async (context: IActionContext) => {
                const subContext = createSubscriptionContext(this.resource.subscription);

                const storageManagementClient: StorageManagementClient = await createStorageClient([context, subContext]);
                const sa: StorageAccount = await storageManagementClient.storageAccounts.getProperties(getResourceGroupFromId(nonNullProp(this.resource, 'id')), nonNullProp(this.resource, 'name'));
                const wrapper = new StorageAccountWrapper(sa);
                const key = await this.getKey(wrapper, storageManagementClient);
                const primaryEndpoints = wrapper.primaryEndpoints;
                const groupTreeItems: StorageAccountModel[] = [];

                if (primaryEndpoints.blob) {
                    const blobServiceClientFactory = () => this.createBlobServiceClient(wrapper, key);
                    const getWebSiteHostingStatus = () => this.getActualWebsiteHostingStatus(blobServiceClientFactory());

                    groupTreeItems.push(new BlobContainerGroupItem(blobServiceClientFactory, getWebSiteHostingStatus));
                }

                if (primaryEndpoints.file) {
                    const shareServiceClientFactory = () => this.createShareServiceClient(wrapper, key);

                    groupTreeItems.push(new FileShareGroupItem(shareServiceClientFactory));
                }

                if (primaryEndpoints.queue) {
                    const queueServiceClientFactory = () => this.createQueueServiceClient(wrapper, key);

                    groupTreeItems.push(new QueueGroupItem(queueServiceClientFactory));
                }

                if (primaryEndpoints.table) {
                    const tableServiceClientFactory = () => this.createTableServiceClient(wrapper, key);

                    groupTreeItems.push(new TableGroupItem(tableServiceClientFactory));
                }

                return groupTreeItems;
            });
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.resource.name, vscode.TreeItemCollapsibleState.Collapsed);

        return treeItem;
    }

    private async getKey(storageAccount: StorageAccountWrapper, storageManagementClient: StorageManagementClient): Promise<StorageAccountKeyWrapper> {
        const keys: StorageAccountKeyWrapper[] = await this.getKeys(storageAccount, storageManagementClient);
        const primaryKey = keys.find(key => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        if (primaryKey) {
            return new StorageAccountKeyWrapper(primaryKey);
        } else {
            throw new Error("Could not find primary key");
        }
    }

    private async getKeys(storageAccount: StorageAccountWrapper, storageManagementClient: StorageManagementClient): Promise<StorageAccountKeyWrapper[]> {
        const parsedId = StorageAccountItem.parseAzureResourceId(storageAccount.id);
        const resourceGroupName = parsedId.resourceGroups;
        const keyResult = await storageManagementClient.storageAccounts.listKeys(resourceGroupName, storageAccount.name);
        return (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
    }

    private static parseAzureResourceId(resourceId: string): { [key: string]: string } {
        const invalidIdErr = new Error('Invalid Account ID.');
        const result = {};

        if (!resourceId || resourceId.length < 2 || resourceId.charAt(0) !== '/') {
            throw invalidIdErr;
        }

        const parts = resourceId.substring(1).split('/');

        if (parts.length % 2 !== 0) {
            throw invalidIdErr;
        }

        for (let i = 0; i < parts.length; i += 2) {
            const key = parts[i];
            const value = parts[i + 1];

            if (key === '' || value === '') {
                throw invalidIdErr;
            }

            result[key] = value;
        }

        return result;
    }

    private createBlobServiceClient(storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): azureStorageBlob.BlobServiceClient {
        const credential = new azureStorageBlob.StorageSharedKeyCredential(storageAccount.name, key.value);
        return new azureStorageBlob.BlobServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'blob'), credential);
    }

    private createShareServiceClient(storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): azureStorageShare.ShareServiceClient {
        const credential = new azureStorageShare.StorageSharedKeyCredential(storageAccount.name, key.value);
        return new azureStorageShare.ShareServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'file'), credential);
    }

    private createQueueServiceClient(storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): azureStorageQueue.QueueServiceClient {
        const credential = new azureStorageQueue.StorageSharedKeyCredential(storageAccount.name, key.value);
        return new azureStorageQueue.QueueServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'queue'), credential);
    }

    private createTableServiceClient(storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): azureDataTables.TableServiceClient {
        const credential = new azureDataTables.AzureNamedKeyCredential(storageAccount.name, key.value);
        return new azureDataTables.TableServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'table'), credential);
    }

    private async getActualWebsiteHostingStatus(serviceClient: azureStorageBlob.BlobServiceClient): Promise<WebSiteHostingStatus> {
        const properties: azureStorageBlob.ServiceGetPropertiesResponse = await serviceClient.getProperties();
        const staticWebsite: azureStorageBlob.StaticWebsite | undefined = properties.staticWebsite;

        return {
            capable: !!staticWebsite,
            enabled: !!staticWebsite && staticWebsite.enabled,
            indexDocument: staticWebsite && staticWebsite.indexDocument,
            errorDocument404Path: staticWebsite && staticWebsite.errorDocument404Path
        };
    }
}
