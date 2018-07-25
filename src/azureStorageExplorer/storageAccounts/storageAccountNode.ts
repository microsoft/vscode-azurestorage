/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { StorageManagementClient } from 'azure-arm-storage';
import * as azureStorage from "azure-storage";
// tslint:disable-next-line:no-require-imports
import opn = require('opn');
import * as path from 'path';
import { commands, MessageItem, Uri, window } from 'vscode';
import { IAzureNode, IAzureParentNode, IAzureParentTreeItem, IAzureTreeItem, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as ext from "../../constants";
import { BlobContainerGroupNode } from '../blobContainers/blobContainerGroupNode';
import { BlobContainerNode } from "../blobContainers/blobContainerNode";
import { FileShareGroupNode } from '../fileShares/fileShareGroupNode';
import { QueueGroupNode } from '../queues/queueGroupNode';
import { TableGroupNode } from '../tables/tableGroupNode';

export type WebsiteHostingStatus = {
    capable: boolean;
    enabled: boolean;
    indexDocument: string;
    errorDocument404Path: string;
};

type StorageTypes = 'Storage' | 'StorageV2' | 'BlobStorage';

export class StorageAccountNode implements IAzureParentTreeItem {
    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly storageManagementClient: StorageManagementClient) {
    }

    public id: string = this.storageAccount.id;
    public label: string = this.storageAccount.name;
    public static contextValue: string = 'azureStorageAccount';
    public contextValue: string = StorageAccountNode.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureStorageAccount_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureStorageAccount_16x.png')
    };

    private _blobContainerGroupNodePromise: Promise<BlobContainerGroupNode>;

    private async getBlobContainerGroupNode(): Promise<BlobContainerGroupNode> {
        const createBlobContainerGroupNode = async (): Promise<BlobContainerGroupNode> => {
            let primaryKey = await this.getPrimaryKey();
            return new BlobContainerGroupNode(this.storageAccount, primaryKey);
        };

        if (!this._blobContainerGroupNodePromise) {
            this._blobContainerGroupNodePromise = createBlobContainerGroupNode();
        }

        return await this._blobContainerGroupNodePromise;
    }

    async loadMoreChildren(_node: IAzureNode, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        let primaryKey = await this.getPrimaryKey();
        let primaryEndpoints = this.storageAccount.primaryEndpoints;
        let groupNodes = [];

        if (!!primaryEndpoints.blob) {
            groupNodes.push(await this.getBlobContainerGroupNode());
        }

        if (!!primaryEndpoints.file) {
            groupNodes.push(new FileShareGroupNode(this.storageAccount, primaryKey));
        }

        if (!!primaryEndpoints.queue) {
            groupNodes.push(new QueueGroupNode(this.storageAccount, primaryKey));
        }

        if (!!primaryEndpoints.table) {
            groupNodes.push(new TableGroupNode(this.storageAccount, primaryKey));
        }

        return groupNodes;
    }

    hasMoreChildren(): boolean {
        return false;
    }

    async getPrimaryKey(): Promise<StorageAccountKey> {
        let keys: StorageAccountKey[] = await this.getKeys();
        let primaryKey = keys.find((key: StorageAccountKey) => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        return primaryKey;
    }

    async getConnectionString(): Promise<string> {
        let primaryKey = await this.getPrimaryKey();
        return `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${primaryKey.value}`;
    }

    async getKeys(): Promise<StorageAccountKey[]> {
        let parsedId = this.parseAzureResourceId(this.storageAccount.id);
        let resourceGroupName = parsedId.resourceGroups;
        let keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
        return keyResult.keys;
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

    public async getWebsiteCapableContainer(node: IAzureParentNode<StorageAccountNode>): Promise<IAzureParentNode<BlobContainerNode>> {
        assert(node.treeItem === this);

        // Refresh the storage account first to make sure $web has been picked up if new
        await node.refresh();

        let groupTreeItem = <IAzureTreeItem>await this.getBlobContainerGroupNode();

        // Currently only the child with the name "$web" is supported for hosting websites
        let id = `${this.id}/${groupTreeItem.id || groupTreeItem.label}/${ext.staticWebsiteContainerName}`;
        let containerNode = <IAzureParentNode<BlobContainerNode>>await node.treeDataProvider.findNode(id);
        return containerNode;
    }

    // This is the URL to use for browsing the website
    public getPrimaryWebEndpoint(): string | undefined {
        // Right now we only support only web endpoint per storage account
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
            blobService.getServiceProperties((err, result: azureStorage.common.models.ServicePropertiesResult.BlobServiceProperties) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        capable: !!result.StaticWebsite,
                        enabled: result.StaticWebsite && result.StaticWebsite.Enabled,
                        indexDocument: result.StaticWebsite && result.StaticWebsite.IndexDocument,
                        errorDocument404Path: result.StaticWebsite && result.StaticWebsite.ErrorDocument404Path
                    });
                }
            });
        });

    }

    private async getAccountType(): Promise<StorageTypes> {
        let blobService = await this.createBlobService();
        return await new Promise<StorageTypes>((resolve, reject) => {
            blobService.getAccountProperties(undefined, undefined, undefined, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(<StorageTypes>result.AccountKind);
                }
            });
        });
    }

    public async configureStaticWebsite(node: IAzureNode): Promise<void> {
        assert(node.treeItem === this);
        let hostingStatus = await this.getWebsiteHostingStatus();
        await this.ensureHostingEnabled(hostingStatus);

        let resourceId = `${node.id}/staticWebsite`;
        node.openInPortal(resourceId);
    }

    public async browseStaticWebsite(node: IAzureNode): Promise<void> {
        assert(node.treeItem === this);
        const configure: MessageItem = {
            title: "Configure website hosting"
        };

        let hostingStatus = await this.getWebsiteHostingStatus();
        await this.ensureHostingEnabled(hostingStatus);

        if (!hostingStatus.enabled) {
            let msg = "Static website hosting is not enabled for this storage account.";
            let result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', node);
            }
            throw new UserCancelledError(msg);
        }

        if (!hostingStatus.indexDocument) {
            let msg = "No index document has been set for this website.";
            let result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', node);
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

    public async ensureHostingEnabled(hostingStatus: WebsiteHostingStatus): Promise<void> {
        if (!hostingStatus.capable) {
            // Doesn't support static website hosting. Try to narrow it down.
            let accountType: StorageTypes;
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
