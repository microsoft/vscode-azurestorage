import * as azureStorageBlob from "@azure/storage-blob";
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath, maxPageSize } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";
import { BlobContainerItem } from "./BlobContainerItem";
import { WebSiteHostingStatus } from "../StorageAccountItem";
import { IStorageRoot } from "../IStorageRoot";
import { parseError } from "@microsoft/vscode-azext-utils";
import { GenericItem } from "../../utils/v2/treeutils";
import { localize } from "../../utils/localize";

export class BlobContainerGroupItem implements StorageAccountModel {
    constructor(
        private readonly getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>,
        private readonly storageRoot: IStorageRoot,
        private readonly subscriptionId: string,
        private readonly refresh?: (model: StorageAccountModel) => void) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        let containers: azureStorageBlob.ContainerItem[];

        try {
            containers = await this.listAllContainers();
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (this.storageRoot.isEmulated && errorType === 'ECONNREFUSED') {
                return [
                    // TODO: Exclude from tree item picker.
                    new GenericItem(
                        () => {
                            const treeItem = new vscode.TreeItem('Start Blob Emulator');

                            treeItem.contextValue = 'startBlobEmulator';
                            treeItem.command = {
                                arguments: [
                                    () => {
                                        this.refresh?.(this);
                                    }
                                ],
                                command: 'azureStorage.startBlobEmulator',
                                title: '' };

                            return treeItem;
                        })
                ];
            } else if (errorType === 'ENOTFOUND') {
                throw new Error(localize('storageAccountDoesNotSupportBlobs', 'This storage account does not support blobs.'));
            } else {
                throw error;
            }
        }

        return containers.map(
            container =>
                new BlobContainerItem(
                    container,
                    { storageAccountId: this.storageRoot.storageAccountId, subscriptionId: this.subscriptionId },
                    () => {
                        const blobServiceClient = this.storageRoot.createBlobServiceClient();
                        return blobServiceClient.getContainerClient(container.name);
                    },
                    this.storageRoot.isEmulated,
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
        const blobServiceClient: azureStorageBlob.BlobServiceClient = this.storageRoot.createBlobServiceClient();
        const response: AsyncIterableIterator<azureStorageBlob.ServiceListContainersSegmentResponse> = blobServiceClient.listContainers().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }
}

export type BlobContainerGroupItemFactory = (getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>, storageRoot: IStorageRoot, subscriptionId: string) => BlobContainerGroupItem;

export function createBlobContainerItemFactory(refresh: (model: StorageAccountModel) => void): BlobContainerGroupItemFactory {
    return (getWebSiteHostingStatus, storageRoot, subscriptionId) => new BlobContainerGroupItem(getWebSiteHostingStatus, storageRoot, subscriptionId, refresh);
}
