/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { AzExtTreeItem, AzureParentTreeItem } from "vscode-azureextensionui";
import { IStorageRoot } from "../IStorageRoot";
import { BlobContainerTreeItem } from "./blobContainerNode";
import { BlobTreeItem } from "./blobNode";

export class BlobDirectoryTreeItem extends AzureParentTreeItem<IStorageRoot> {
    private _continuationTokenBlob: azureStorage.common.ContinuationToken | undefined;
    private _continuationTokenDir: azureStorage.common.ContinuationToken | undefined;

    public basename: string = path.basename(this.name);
    public label: string = this.basename;
    public contextValue: string = 'azureBlobDirectory';

    constructor(
        parent: BlobContainerTreeItem | BlobDirectoryTreeItem,
        public name: string,
        public container: azureStorage.BlobService.ContainerResult) {
        super(parent);
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationTokenBlob = undefined;
            this._continuationTokenDir = undefined;
        }

        let blobService = this.root.createBlobService();
        let blobRes = await new Promise<azureStorage.BlobService.ListBlobsResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobsSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: "${this.name}"`);
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobsSegmentedWithPrefix(this.container.name, this.name, <azureStorage.common.ContinuationToken>undefined!, { delimiter: '/' }, (error?: Error, result?: azureStorage.BlobService.ListBlobsResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
        let dirRes = await new Promise<azureStorage.BlobService.ListBlobDirectoriesResult>((resolve, reject) => {
            console.log(`${new Date().toLocaleTimeString()}: Querying Azure... Method: listBlobDirectoriesSegmentedWithPrefix blobContainerName: "${this.container.name}" prefix: "${this.name}"`);
            // Intentionally passing undefined for token - only supports listing first batch of files for now
            // tslint:disable-next-line: no-non-null-assertion
            blobService.listBlobDirectoriesSegmentedWithPrefix(this.container.name, this.name, <azureStorage.common.ContinuationToken>undefined!, (error?: Error, result?: azureStorage.BlobService.ListBlobDirectoriesResult) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });

        this._continuationTokenBlob = blobRes.continuationToken;
        this._continuationTokenDir = dirRes.continuationToken;

        let children: AzExtTreeItem[] = [];
        for (const blob of blobRes.entries) {
            children.push(new BlobTreeItem(this, blob, this.container));
        }
        for (const dir of dirRes.entries) {
            children.push(new BlobDirectoryTreeItem(this, dir.name, this.container));
        }

        return children;
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._continuationTokenBlob || !!this._continuationTokenDir;
    }
}
