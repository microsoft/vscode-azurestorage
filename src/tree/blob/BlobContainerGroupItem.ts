import * as azureStorageBlob from "@azure/storage-blob";
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath, maxPageSize } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";
import { BlobContainerItem } from "./BlobContainerItem";
import { WebSiteHostingStatus } from "../StorageAccountItem";

export class BlobContainerGroupItem implements StorageAccountModel {
    constructor(
        private readonly blobServiceClientFactory: () => azureStorageBlob.BlobServiceClient,
        private readonly getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const containers = await this.listAllContainers();

        return containers.map(
            container =>
                new BlobContainerItem(
                    container,
                    () => {
                        const blobServiceClient = this.blobServiceClientFactory();
                        return blobServiceClient.getContainerClient(container.name);
                    },
                    /* isEmulated: TODO: fix */ false,
                    this.getWebSiteHostingStatus));
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Blob Containers', vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureBlobContainerGroup';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureBlobContainer.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureBlobContainer.svg')
        };

        return treeItem;
    }

    async listAllContainers(): Promise<azureStorageBlob.ContainerItem[]> {
        let response: azureStorageBlob.ListContainersSegmentResponse | undefined;

        const containers: azureStorageBlob.ContainerItem[] = [];

        do {
            response = await this.listContainers(response?.continuationToken);

            if (response.containerItems) {
                containers.push(...response.containerItems);
            }
        } while (response.continuationToken);

        return containers;
    }

    async listContainers(continuationToken?: string): Promise<azureStorageBlob.ListContainersSegmentResponse> {
        const blobServiceClient: azureStorageBlob.BlobServiceClient = this.blobServiceClientFactory();
        const response: AsyncIterableIterator<azureStorageBlob.ServiceListContainersSegmentResponse> = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }
}
