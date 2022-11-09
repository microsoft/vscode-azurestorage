import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath, staticWebsiteContainerName } from '../../constants';
import { createBlobContainerClient } from '../../utils/blobUtils';
import { GenericItem } from "../../utils/v2/treeutils";
import { IStorageRoot } from '../IStorageRoot';
import { WebSiteHostingStatus } from "../StorageAccountItem";
import { StorageAccountModel } from "../StorageAccountModel";
import { BlobDirectoryItem } from "./BlobDirectoryItem";
import { BlobParentItem } from "./BlobParentItem";

export class BlobContainerItem extends BlobParentItem {
    constructor(
        private readonly container: azureStorageBlob.ContainerItem,
        public readonly context: { storageAccountId: string, subscriptionId: string },
        blobContainerClientFactory: () => azureStorageBlob.ContainerClient,
        isEmulated: boolean,
        private readonly getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>,
        storageRoot: IStorageRoot,
        public readonly onDeleted: () => void) {
        super(
            blobContainerClientFactory,
            (dirPath: string) => new BlobDirectoryItem(blobContainerClientFactory, container.name, isEmulated, dirPath, storageRoot),
            isEmulated,
            /* prefix: */ undefined,
            storageRoot);
    }

    get containerName(): string {
        return this.container.name;
    }

    get copyUrl(): vscode.Uri {
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(this.storageRoot, this.container.name);
        return vscode.Uri.parse(containerClient.url);
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const children = await super.getChildren();

        return [
            new GenericItem(
                () => {
                    const treeItem = new vscode.TreeItem('Open in File Explorer...');

                    treeItem.command = {
                        arguments: [this],
                        command: 'azureStorage.openInFileExplorer',
                        title: ''
                    };
                    treeItem.contextValue = 'openInFileExplorer';

                    return treeItem;
                }),
            ...children
        ];
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const websiteHostingStatus = await this.getWebSiteHostingStatus();
        const iconFileName = websiteHostingStatus.enabled && this.container.name === staticWebsiteContainerName ?
            'BrandAzureStaticWebsites' : 'AzureBlobContainer';

        const treeItem = new vscode.TreeItem(this.container.name, vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureBlobContainer';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', `${iconFileName}.svg`),
            dark: path.join(getResourcesPath(), 'dark', `${iconFileName}.svg`)
        };

        return treeItem;
    }
}
