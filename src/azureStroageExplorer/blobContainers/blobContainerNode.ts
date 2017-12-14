/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { BlobNode } from './blobNode';

import { IAzureParentTreeItem, IAzureTreeItem, IAzureNode } from 'vscode-azureextensionui';
import { Uri } from 'vscode';

export class BlobContainerNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly container: azureStorage.BlobService.ContainerResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public id: string = undefined;
    public label: string = this.container.name;
    public contextValue: string = 'azureBlobContainer';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    async loadMoreChildren(_node: IAzureNode, clearCache: boolean): Promise<IAzureTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        var blobs = await this.listBlobs(this._continuationToken);
        var { entries, continuationToken } = blobs;
        this._continuationToken = continuationToken;
        return entries.map((blob: azureStorage.BlobService.BlobResult) => {
            return new BlobNode(blob, this.container, this.storageAccount, this.key);
        });
    }

    listBlobs(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.BlobService.ListBlobsResult> {
        return new Promise(resolve => {
            var blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
            blobService.listBlobsSegmented(this.container.name, currentToken, { maxResults: 50 }, (_err, result: azureStorage.BlobService.ListBlobsResult) => {
                resolve(result);
            })
        });
    }
}
