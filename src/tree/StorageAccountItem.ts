import { StorageAccountKey, StorageManagementClient } from '@azure/arm-storage';
import * as azureDataTables from '@azure/data-tables';
import * as azureStorageBlob from "@azure/storage-blob";
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorageQueue from '@azure/storage-queue';
import { nonNullProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from '../utils/storageWrappers';
import { ApplicationResource } from '../vscode-azureresourcegroups.api.v2';
import { BlobContainerGroupItem } from './blob/BlobContainerGroupItem';
import { FileShareGroupItem } from './fileShare/FileShareGroupItem';
import { createFileShareItemFactory } from "./fileShare/FileShareItem";
import { IStorageRoot } from "./IStorageRoot";
import { QueueGroupItem } from './queue/QueueGroupItem';
import { StorageAccountModel } from './StorageAccountModel';
import { TableGroupItem } from './table/TableGroupItem';

export type WebSiteHostingStatus = {
    capable: boolean;
    enabled: boolean;
    indexDocument?: string;
    errorDocument404Path?: string;
};

export class StorageAccountItem implements StorageAccountModel {
    public static contextValue: string = 'azureStorageAccount';

    private _key: StorageAccountKeyWrapper | undefined;

    constructor(
        private readonly resource: ApplicationResource,
        public readonly storageAccount: StorageAccountWrapper,
        private readonly storageManagementClient: StorageManagementClient,
        private readonly refresh: (model: StorageAccountModel) => void,
        private readonly refreshParent: () => void) {
    }

    readonly notifyChanged = this.refreshParent;
    readonly name = this.storageAccount.name;
    readonly storageAccountId = this.storageAccount.id;
    readonly subscription = this.resource.subscription;
    readonly subscriptionId = this.resource.subscription.subscriptionId;

    async getChildren(): Promise<StorageAccountModel[]> {
        const key = await this.getKey();
        const storageRoot = this.createRoot(this.storageAccount, key);
        const primaryEndpoints = this.storageAccount.primaryEndpoints;
        const groupTreeItems: StorageAccountModel[] = [];

        if (primaryEndpoints.blob) {
            const getWebSiteHostingStatus = () => this.getActualWebsiteHostingStatus(storageRoot.createBlobServiceClient());

            groupTreeItems.push(new BlobContainerGroupItem(getWebSiteHostingStatus, storageRoot, this.resource.subscription.subscriptionId, this.refresh));
        }

        if (primaryEndpoints.file) {
            const shareServiceClientFactory = () => this.createShareServiceClient(this.storageAccount, key);
            const shareClientFactory = (shareName: string) => shareServiceClientFactory().getShareClient(shareName);
            const fileShareItemFactory = createFileShareItemFactory(
                shareClientFactory,
                {
                    id: this.resource.id,
                    isEmulated: false, // TODO: Determine if this is an emulator
                    subscriptionId: this.resource.subscription.subscriptionId
                },
                storageRoot);

            groupTreeItems.push(
                new FileShareGroupItem(
                    fileShareItemFactory,
                    shareServiceClientFactory,
                    storageRoot,
                    model => this.refresh(model)));
        }

        if (primaryEndpoints.queue) {
            groupTreeItems.push(new QueueGroupItem(storageRoot, this.resource.subscription.subscriptionId, this.refresh));
        }

        if (primaryEndpoints.table) {
            groupTreeItems.push(new TableGroupItem(storageRoot, this.resource.subscription.subscriptionId, this.refresh));
        }

        return groupTreeItems;
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.resource.name, vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureStorageAccount';

        return treeItem;
    }

    async getConnectionString(): Promise<string> {
        const key = await this.getKey();
        return `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${key.value};EndpointSuffix=${nonNullProp(this.resource.subscription.environment, 'storageEndpointSuffix')}`;
    }

    async getKey(): Promise<StorageAccountKeyWrapper> {
        if (!this._key) {
            const keys: StorageAccountKeyWrapper[] = await this.getKeys();
            const primaryKey = keys.find(key => {
                return key.keyName === "key1" || key.keyName === "primaryKey";
            });

            if (primaryKey) {
                this._key = new StorageAccountKeyWrapper(primaryKey);
            } else {
                throw new Error("Could not find primary key");
            }
        }

        return this._key;
    }

    private async getKeys(): Promise<StorageAccountKeyWrapper[]> {
        const parsedId = StorageAccountItem.parseAzureResourceId(this.storageAccount.id);
        const resourceGroupName = parsedId.resourceGroups;
        const keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
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

    private createRoot(storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): IStorageRoot {
        return {
            storageAccountName: storageAccount.name,
            storageAccountId: storageAccount.id,
            isEmulated: false,
            primaryEndpoints: storageAccount.primaryEndpoints,
            generateSasToken: (accountSASSignatureValues: azureStorageBlob.AccountSASSignatureValues) => {
                return azureStorageBlob.generateAccountSASQueryParameters(
                    accountSASSignatureValues,
                    new azureStorageBlob.StorageSharedKeyCredential(storageAccount.name, key.value)
                ).toString();
            },
            createBlobServiceClient: () => {
                const credential = new azureStorageBlob.StorageSharedKeyCredential(storageAccount.name, key.value);
                return new azureStorageBlob.BlobServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'blob'), credential);
            },
            createShareServiceClient: () => {
                const credential = new azureStorageShare.StorageSharedKeyCredential(storageAccount.name, key.value);
                return new azureStorageShare.ShareServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'file'), credential);
            },
            createQueueServiceClient: () => {
                const credential = new azureStorageQueue.StorageSharedKeyCredential(storageAccount.name, key.value);
                return new azureStorageQueue.QueueServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'queue'), credential);
            },
            createTableServiceClient: () => {
                const credential = new azureDataTables.AzureNamedKeyCredential(storageAccount.name, key.value);
                return new azureDataTables.TableServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'table'), credential);
            }
        };
    }

    private createShareServiceClient(storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): azureStorageShare.ShareServiceClient {
        const credential = new azureStorageShare.StorageSharedKeyCredential(storageAccount.name, key.value);
        return new azureStorageShare.ShareServiceClient(nonNullProp(storageAccount.primaryEndpoints, 'file'), credential);
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
