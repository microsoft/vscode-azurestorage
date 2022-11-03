import * as azureStorageBlob from "@azure/storage-blob";
import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath, staticWebsiteContainerName } from '../../constants';
import { GenericItem } from "../../utils/v2/treeutils";
import { ApplicationResourceModel } from '../../vscode-azureresourcegroups.api.v2';
import { IStorageRoot } from '../IStorageRoot';
import { WebSiteHostingStatus } from "../StorageAccountItem";
import { StorageAccountModel } from "../StorageAccountModel";
import { BlobDirectoryItem } from "./BlobDirectoryItem";
import { BlobParentItem } from "./BlobParentItem";

export class BlobContainerItem extends BlobParentItem implements ApplicationResourceModel {
    constructor(
        private readonly container: azureStorageBlob.ContainerItem,
        public readonly context: { storageAccountId: string, subscriptionId: string },
        blobContainerClientFactory: () => azureStorageBlob.ContainerClient,
        isEmulated: boolean,
        private readonly getWebSiteHostingStatus: () => Promise<WebSiteHostingStatus>,
        storageRoot: IStorageRoot) {
        super(
            blobContainerClientFactory,
            (dirPath: string) => new BlobDirectoryItem(blobContainerClientFactory, isEmulated, dirPath, storageRoot),
            isEmulated,
            /* prefix: */ undefined,
            storageRoot);
    }

    get containerName(): string {
        return this.container.name;
    }

    readonly portalUrl = vscode.Uri.parse('https://google.com');

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
