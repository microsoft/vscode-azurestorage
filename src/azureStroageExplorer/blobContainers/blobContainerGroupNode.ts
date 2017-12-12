/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { BlobContainerNode } from './blobContainerNode';
import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureParentTreeItem, IAzureTreeItem } from 'vscode-azureextensionui';
import { Uri } from 'vscode';

export class BlobContainerGroupNode implements IAzureParentTreeItem {
    private _continuationToken: azureStorage.common.ContinuationToken;

    constructor(
        public readonly subscription: Subscription, 
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public id: string = "Blob Containers";
    public label: string = "Blob Containers";
    public contextValue: string = 'azureBlobContainerGroup';
    public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureBlob_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureBlob_16x.png')
    };


    async loadMoreChildren(): Promise<IAzureTreeItem[]> {
        var containers = await this.listContainers(this._continuationToken);
        var {entries , continuationToken} = containers;
        this._continuationToken = continuationToken;

        return entries.map((container: azureStorage.BlobService.ContainerResult) => {
            return new BlobContainerNode(this.subscription, container, this.storageAccount, this.key);
        });
    }

    hasMoreChildren(): boolean {
        return !!this._continuationToken;
    }

    listContainers(currentToken: azureStorage.common.ContinuationToken): Promise<azureStorage.BlobService.ListContainerResult> {
        return new Promise(resolve => {
            var blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
			blobService.listContainersSegmented(currentToken, {maxResults: 50}, (_err, result: azureStorage.BlobService.ListContainerResult) => {
				resolve(result);
			})
		});
    }
}
