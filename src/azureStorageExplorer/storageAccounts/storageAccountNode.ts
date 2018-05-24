/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import * as ext from "../../constants";
import * as path from 'path';
import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { BlobContainerGroupNode } from '../blobContainers/blobContainerGroupNode';
import StorageManagementClient = require('azure-arm-storage');

import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode, IActionContext, IAzureParentNode } from 'vscode-azureextensionui';
import { FileShareGroupNode } from '../fileShares/fileShareGroupNode';
import { QueueGroupNode } from '../queues/queueGroupNode';
import { TableGroupNode } from '../tables/tableGroupNode';
import { BlobContainerNode } from "../blobContainers/blobContainerNode";

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
        let resourceGroupName = parsedId["resourceGroups"];
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

    public async deployStaticWebsite(node: IAzureParentNode<StorageAccountNode>, actionContext: IActionContext, sourcePath: string): Promise<void> {
        let groupTreeItem = <IAzureTreeItem>await this.getBlobContainerGroupNode(); // asdf
        let id = `${this.id}/${groupTreeItem.id || groupTreeItem.label}/${ext.staticWebsiteContainerName}`;
        let containerNode = <IAzureParentNode<BlobContainerNode>>await node.treeDataProvider.findNode(id); // asdf does this load more?
        if (containerNode) {
            return await containerNode.treeItem.deployStaticWebsite(containerNode, actionContext, sourcePath);
        }

        // asdf: enable web hosting
        // this.storageAccount;

    }

    // private async getWebsiteHostingContainers(): Promise<BlobContainerNode[]> {
    //     let groupNode = await this.getBlobContainerGroupNode();
    //     let a = await groupNode.loadMoreChildren(groupNode, true); // asdf
    // }
}
