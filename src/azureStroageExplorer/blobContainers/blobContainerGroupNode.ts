/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { BlobContainerNode } from './blobContainerNode';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode } from 'vscode-azureextensionui';
import { Uri } from 'vscode';

export class BlobContainerGroupNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public id: string = undefined;
    public label: string = "Blob Containers";
    public contextValue: string = 'azureBlobContainerGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };


    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        var containers = await this.listContainers(this._continuationToken);
        var { entries, continuationToken } = containers;
        this._continuationToken = continuationToken;

        return entries.map((container: azureStorage.BlobService.ContainerResult) => {
            return new BlobContainerNode(container, this.storageAccount, this.key);
        });
    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    listContainers(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.BlobService.ListContainerResult> {
        return new Promise(resolve => {
            var blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
            blobService.listContainersSegmented(currentToken, { maxResults: 50 }, (_err, result: azureStorage.BlobService.ListContainerResult) => {
                resolve(result);
            })
        });
    }
}
