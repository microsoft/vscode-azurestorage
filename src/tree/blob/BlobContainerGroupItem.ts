import * as azureStorageBlob from "@azure/storage-blob";
import { parseError } from "@microsoft/vscode-azext-utils";
import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath } from '../../constants';
import { delay } from "../../utils/delay";
import { localize } from "../../utils/localize";
import { GenericItem } from "../../utils/v2/treeutils";
import { IStorageRoot } from "../IStorageRoot";
import { WebSiteHostingStatus } from "../StorageAccountItem";
import { StorageAccountModel } from "../StorageAccountModel";
import { BlobContainerItem } from "./BlobContainerItem";
import { listAllContainers } from './blobUtils';

export class BlobContainerGroupItem implements StorageAccountModel {
    constructor(
        private readonly getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>,
        public readonly storageRoot: IStorageRoot,
        private readonly subscriptionId: string,
        private readonly refresh: (model: StorageAccountModel) => void) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        let containers: azureStorageBlob.ContainerItem[] | undefined;

        const tries = 3;

        for (let i = 0; i < tries; i++) {
            containers = await this.getContainers();

            if (containers) {
                break;
            } else {
                await delay(500);
            }
        }

        if (containers) {
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
                        this.getWebSiteHostingStatus,
                        this.storageRoot,
                        () => this.notifyChanged()));
        } else {
            return [
                // TODO: Exclude from tree item picker.
                new GenericItem(
                    () => {
                        const treeItem = new vscode.TreeItem('Start Blob Emulator');

                        treeItem.contextValue = 'startBlobEmulator';
                        treeItem.command = {
                            arguments: [
                                () => {
                                    this.refresh(this);
                                }
                            ],
                            command: 'azureStorage.startBlobEmulator',
                            title: ''
                        };

                        return treeItem;
                    })
            ];
        }
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

    notifyChanged(): void {
        this.refresh(this);
    }

    private async getContainers(): Promise<azureStorageBlob.ContainerItem[] | undefined> {
        try {
            return await listAllContainers(this.storageRoot.createBlobServiceClient());
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (this.storageRoot.isEmulated && errorType === 'ECONNREFUSED') {
                return undefined;
            } else if (errorType === 'ENOTFOUND') {
                throw new Error(localize('storageAccountDoesNotSupportBlobs', 'This storage account does not support blobs.'));
            } else {
                throw error;
            }
        }
    }
}

export type BlobContainerGroupItemFactory = (getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>, storageRoot: IStorageRoot, subscriptionId: string) => BlobContainerGroupItem;

export function createBlobContainerItemFactory(refresh: (model: StorageAccountModel) => void): BlobContainerGroupItemFactory {
    return (getWebSiteHostingStatus, storageRoot, subscriptionId) => new BlobContainerGroupItem(getWebSiteHostingStatus, storageRoot, subscriptionId, refresh);
}
