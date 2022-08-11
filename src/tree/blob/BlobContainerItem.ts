import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath, staticWebsiteContainerName } from '../../constants';
import { WebSiteHostingStatus } from "../StorageAccountItem";
import { BlobDirectoryItem } from "./BlobDirectoryItem";
import { BlobParentItem } from "./BlobParentItem";

export class BlobContainerItem extends BlobParentItem {
    constructor(
        private readonly container: azureStorageBlob.ContainerItem,
        blobContainerClientFactory: () => azureStorageBlob.ContainerClient,
        isEmulated: boolean,
        private readonly getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>) {
        super(
            blobContainerClientFactory,
            (dirPath: string) => new BlobDirectoryItem(blobContainerClientFactory, isEmulated, dirPath),
            isEmulated,
            /* prefix: */ undefined);
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
