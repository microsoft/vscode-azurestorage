/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient } from 'azure-arm-storage';
import * as azureStorage from "azure-storage";
// tslint:disable-next-line:no-require-imports
import opn = require('opn');
import * as path from 'path';
import { commands, MessageItem, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from '../../components/storageWrappers';
import * as ext from "../../constants";
import { BlobContainerGroupTreeItem } from '../blobContainers/blobContainerGroupNode';
import { BlobContainerTreeItem } from "../blobContainers/blobContainerNode";
import { FileShareGroupTreeItem } from '../fileShares/fileShareGroupNode';
import { QueueGroupTreeItem } from '../queues/queueGroupNode';
import { TableGroupTreeItem } from '../tables/tableGroupNode';

export type WebsiteHostingStatus = {
    capable: boolean;
    enabled: boolean;
    indexDocument?: string;
    errorDocument404Path?: string;
};

type StorageTypes = 'Storage' | 'StorageV2' | 'BlobStorage';

export class StorageAccountTreeItem extends AzureParentTreeItem {
    constructor(
        parent: AzureParentTreeItem,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly storageManagementClient: StorageManagementClient) {
        super(parent);
    }

    public id: string = this.storageAccount.id;
    public label: string = this.storageAccount.name;
    public static contextValue: string = 'azureStorageAccount';
    public contextValue: string = StorageAccountTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureStorageAccount_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureStorageAccount_16x.png')
    };

    private _blobContainerGroupTreeItemPromise: Promise<BlobContainerGroupTreeItem> | undefined;

    private async getBlobContainerGroupTreeItem(): Promise<BlobContainerGroupTreeItem> {
        const createBlobContainerGroupTreeItem = async (): Promise<BlobContainerGroupTreeItem> => {
            let primaryKey = await this.getPrimaryKey();
            return new BlobContainerGroupTreeItem(this, this.storageAccount, new StorageAccountKeyWrapper(primaryKey));
        };

        if (!this._blobContainerGroupTreeItemPromise) {
            this._blobContainerGroupTreeItemPromise = createBlobContainerGroupTreeItem();
        }

        return await this._blobContainerGroupTreeItemPromise;
    }

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem[]> {
        let primaryKey = await this.getPrimaryKey();
        let primaryEndpoints = this.storageAccount.primaryEndpoints;
        let groupTreeItems: AzureTreeItem[] = [];

        if (!!primaryEndpoints.blob) {
            groupTreeItems.push(await this.getBlobContainerGroupTreeItem());
        }

        if (!!primaryEndpoints.file) {
            groupTreeItems.push(new FileShareGroupTreeItem(this, this.storageAccount, primaryKey));
        }

        if (!!primaryEndpoints.queue) {
            groupTreeItems.push(new QueueGroupTreeItem(this, this.storageAccount, primaryKey));
        }

        if (!!primaryEndpoints.table) {
            groupTreeItems.push(new TableGroupTreeItem(this, this.storageAccount, primaryKey));
        }

        return groupTreeItems;
    }

    hasMoreChildrenImpl(): boolean {
        return false;
    }

    async getPrimaryKey(): Promise<StorageAccountKeyWrapper> {
        let keys: StorageAccountKeyWrapper[] = await this.getKeys();
        let primaryKey = keys.find(key => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        if (primaryKey) {
            return new StorageAccountKeyWrapper(primaryKey);
        } else {
            throw new Error("Could not find primary key");
        }
    }

    async getConnectionString(): Promise<string> {
        let primaryKey = await this.getPrimaryKey();
        return `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${primaryKey.value}`;
    }

    async getKeys(): Promise<StorageAccountKeyWrapper[]> {
        let parsedId = this.parseAzureResourceId(this.storageAccount.id);
        let resourceGroupName = parsedId.resourceGroups;
        let keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
        // tslint:disable-next-line:strict-boolean-expressions
        return (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
    }

    parseAzureResourceId(resourceId: string): { [key: string]: string } {
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

    public async getWebsiteCapableContainer(): Promise<BlobContainerTreeItem | undefined> {
        // Refresh the storage account first to make sure $web has been picked up if new
        await this.refresh();

        let groupTreeItem = <AzureTreeItem>await this.getBlobContainerGroupTreeItem();

        // Currently only the child with the name "$web" is supported for hosting websites
        let id = `${this.id}/${groupTreeItem.id || groupTreeItem.label}/${ext.staticWebsiteContainerName}`;
        let containerTreeItem = <BlobContainerTreeItem>await this.treeDataProvider.findTreeItem(id);
        return containerTreeItem;
    }

    // This is the URL to use for browsing the website
    public getPrimaryWebEndpoint(): string | undefined {
        // Right now Azure only supports one web endpoint per storage account
        return this.storageAccount.primaryEndpoints.web;
    }

    public async createBlobService(): Promise<azureStorage.BlobService> {
        let primaryKey = await this.getPrimaryKey();
        let blobService = azureStorage.createBlobService(this.storageAccount.name, primaryKey.value);
        return blobService;
    }

    public async getWebsiteHostingStatus(): Promise<WebsiteHostingStatus> {
        let blobService = await this.createBlobService();

        return await new Promise<WebsiteHostingStatus>((resolve, reject) => {
            // tslint:disable-next-line:no-any
            blobService.getServiceProperties((err?: any, result?: azureStorage.common.models.ServicePropertiesResult.BlobServiceProperties) => {
                if (err) {
                    reject(err);
                } else {
                    let staticWebsite: azureStorage.common.models.ServicePropertiesResult.StaticWebsiteProperties | undefined =
                        result && result.StaticWebsite;
                    resolve(<WebsiteHostingStatus>{
                        capable: !!staticWebsite,
                        enabled: !!staticWebsite && staticWebsite.Enabled,
                        indexDocument: staticWebsite && staticWebsite.IndexDocument,
                        errorDocument404Path: staticWebsite && staticWebsite.ErrorDocument404Path
                    });
                }
            });
        });

    }

    private async getAccountType(): Promise<StorageTypes> {
        let blobService = await this.createBlobService();
        return await new Promise<StorageTypes>((resolve, reject) => {
            // tslint:disable-next-line:no-any
            blobService.getAccountProperties(undefined, undefined, undefined, (err?: any, result?) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(<StorageTypes>result.AccountKind);
                }
            });
        });
    }

    public async configureStaticWebsite(): Promise<void> {
        let hostingStatus = await this.getWebsiteHostingStatus();
        await this.ensureHostingCapable(hostingStatus);

        let resourceId = `${this.fullId}/staticWebsite`;
        this.openInPortal(resourceId);
    }

    public async browseStaticWebsite(): Promise<void> {
        const configure: MessageItem = {
            title: "Configure website hosting"
        };

        let hostingStatus = await this.getWebsiteHostingStatus();
        await this.ensureHostingCapable(hostingStatus);

        if (!hostingStatus.enabled) {
            let msg = "Static website hosting is not enabled for this storage account.";
            let result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', this);
            }
            throw new UserCancelledError(msg);
        }

        if (!hostingStatus.indexDocument) {
            let msg = "No index document has been set for this website.";
            let result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', this);
            }
            throw new UserCancelledError(msg);
        }

        let endpoint = this.getPrimaryWebEndpoint();
        if (endpoint) {
            await opn(endpoint);
        } else {
            throw new Error(`Could not retrieve the primary web endpoint for ${this.label}`);
        }
    }

    public async ensureHostingCapable(hostingStatus: WebsiteHostingStatus): Promise<void> {
        if (!hostingStatus.capable) {
            // Doesn't support static website hosting. Try to narrow it down.
            let accountType: StorageTypes | undefined;
            try {
                accountType = await this.getAccountType();
            } catch (error) {
                // Ignore errors
            }
            if (accountType !== 'StorageV2') {
                throw new Error("Only general purpose V2 storage accounts support static website hosting.");
            }

            throw new Error("This storage account does not support static website hosting.");
        }
    }
}
