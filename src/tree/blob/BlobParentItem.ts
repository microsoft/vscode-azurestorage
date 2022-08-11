import { PageSettings } from '@azure/core-paging';
import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { maxPageSize } from "../../constants";
import { StorageAccountModel } from "../StorageAccountModel";
import { BlobItem } from "./BlobItem";

export abstract class BlobParentItem implements StorageAccountModel {
    constructor(
        private readonly blobContainerClientFactory: () => azureStorageBlob.ContainerClient,
        private readonly parentItemFactory: (dirPath: string) => BlobParentItem,
        private readonly isEmulated: boolean,
        private readonly prefix: string | undefined) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const containerClient: azureStorageBlob.ContainerClient = this.blobContainerClientFactory();
        // TODO: Manage paging.
        let continuationToken: string | undefined = undefined;
        const settings: PageSettings = {
            continuationToken,
            // https://github.com/Azure/Azurite/issues/605
            maxPageSize: this.isEmulated ? maxPageSize * 10 : maxPageSize
        };
        const response: AsyncIterableIterator<azureStorageBlob.ContainerListBlobHierarchySegmentResponse> = containerClient.listBlobsByHierarchy(path.posix.sep, { prefix: this.prefix }).byPage(settings);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const responseValue: azureStorageBlob.ListBlobsHierarchySegmentResponse = (await response.next()).value;
        continuationToken = responseValue.continuationToken;

        const children: StorageAccountModel[] = [];
        for (const blob of responseValue.segment.blobItems) {
            // NOTE: `blob.name` as returned from Azure is actually the blob path in the container
            children.push(new BlobItem(blob.name));
        }

        for (const directory of responseValue.segment.blobPrefixes || []) {
            // NOTE: `directory.name` as returned from Azure is actually the directory path in the container
            children.push(this.parentItemFactory(directory.name));
        }

        return children;
    }

    abstract getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem>;
}
