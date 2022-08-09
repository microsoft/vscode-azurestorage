import * as azureStorageBlob from "@azure/storage-blob";
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath, staticWebsiteContainerName } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";
import { WebSiteHostingStatus } from "../StorageAccountItem";

export class BlobContainerItem implements StorageAccountModel {
    constructor(
        private readonly container: azureStorageBlob.ContainerItem,
        private readonly getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>) {
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return undefined;
    }

    async getTreeItem(): Promise<vscode.TreeItem> {
        const websiteHostingStatus = await this.getWebSiteHostingStatus();
        const iconFileName = websiteHostingStatus.enabled && this.container.name === staticWebsiteContainerName ?
            'BrandAzureStaticWebsites' : 'AzureBlobContainer';

        const treeItem = new vscode.TreeItem(this.container.name);

        treeItem.contextValue = 'azureBlobContainer';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', `${iconFileName}.svg`),
            dark: path.join(getResourcesPath(), 'dark', `${iconFileName}.svg`)
        };

        return treeItem;
    }
}
