/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import StorageManagementClient = require('azure-arm-storage');
import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { BlobContainerGroupNode } from '../blobContainers/blobContainerGroupNode';
import * as path from 'path';

import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode } from 'vscode-azureextensionui';
import { FileShareGroupNode } from '../fileShares/fileShareGroupNode';
import { QueueGroupNode } from '../queues/queueGroupNode';
import { TableGroupNode } from '../tables/tableGroupNode';

export class StorageAccountNode implements IAzureParentTreeItem {
    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly storageManagementClient: StorageManagementClient) {
    }

    public id: string = this.storageAccount.id;
    public label: string = this.storageAccount.name;
    public contextValue: string = 'azureStorageAccount';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureStorageAccount_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureStorageAccount_16x.png')
    };

    async loadMoreChildren(_node: IAzureNode, _clearCache: boolean): Promise<IAzureTreeItem[]> {
        var primaryKey = await this.getPrimaryKey();
        var primaryEndpoints = this.storageAccount.primaryEndpoints;
        var groupNodes = [];

        if (!!primaryEndpoints.blob) {
            groupNodes.push(new BlobContainerGroupNode(this.storageAccount, primaryKey));
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
        var keys: StorageAccountKey[] = await this.getKeys();
        var primaryKey = keys.find((key: StorageAccountKey) => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        return primaryKey;
    }

    async getConnectionString() {
        var primaryKey = await this.getPrimaryKey();
        return `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${primaryKey.value}`;
    }

    async getKeys() {
        var parsedId = this.parseAzureResourceId(this.storageAccount.id);
        var resourceGroupName = parsedId["resourceGroups"];
        var keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
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
}
