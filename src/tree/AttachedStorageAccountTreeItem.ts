/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri } from 'vscode';
import { AzExtParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { getResourcesPath } from '../constants';
import { StorageAccountWrapper } from '../utils/storageWrappers';
import { AttachedStorageAccountsTreeItem } from './AttachedStorageAccountsTreeItem';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { FileShareGroupTreeItem } from './fileShare/FileShareGroupTreeItem';
import { IAttachedStorageRoot, IStorageRoot } from './IStorageRoot';
import { QueueGroupTreeItem } from './queue/QueueGroupTreeItem';
import { StorageAccountTreeItem, WebsiteHostingStatus } from './StorageAccountTreeItem';
import { TableGroupTreeItem } from './table/TableGroupTreeItem';

export class AttachedStorageAccountTreeItem extends AzExtParentTreeItem {
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
    };
    public childTypeLabel: string = 'resource type';
    public autoSelectInTreeItemPicker: boolean = true;
    public id: string = this.storageAccount.id;
    public label: string = this.storageAccount.name;
    public static contextValue: string = `${StorageAccountTreeItem.contextValue}-attached`;
    public contextValue: string = AttachedStorageAccountTreeItem.contextValue;

    private readonly _blobContainerGroupTreeItem: BlobContainerGroupTreeItem;
    private readonly _fileShareGroupTreeItem: FileShareGroupTreeItem;
    private readonly _queueGroupTreeItem: QueueGroupTreeItem;
    private readonly _tableGroupTreeItem: TableGroupTreeItem;
    private _root: IAttachedStorageRoot;

    constructor(
        parent: AzExtParentTreeItem,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly connectionString: string) {
        super(parent);
        this._root = this.createRoot();
        this._blobContainerGroupTreeItem = new BlobContainerGroupTreeItem(this);
        this._fileShareGroupTreeItem = new FileShareGroupTreeItem(this);
        this._queueGroupTreeItem = new QueueGroupTreeItem(this);
        this._tableGroupTreeItem = new TableGroupTreeItem(this);
    }

    public get root(): IAttachedStorageRoot {
        return this._root;
    }

    public async loadMoreChildrenImpl(): Promise<AzureTreeItem<IStorageRoot>[]> {
        let groupTreeItems: AzureTreeItem<IStorageRoot>[] = [this._blobContainerGroupTreeItem, this._queueGroupTreeItem];

        if (this.connectionString === AttachedStorageAccountsTreeItem.emulatorConnectionString) {
            this._blobContainerGroupTreeItem.active = await this._blobContainerGroupTreeItem.isActive();
            this._blobContainerGroupTreeItem.isEmulated = true;
            this._queueGroupTreeItem.active = await this._queueGroupTreeItem.isActive();
            this._queueGroupTreeItem.isEmulated = true;
        } else {
            groupTreeItems.push(this._fileShareGroupTreeItem);
            groupTreeItems.push(this._tableGroupTreeItem);
        }

        return groupTreeItems;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async getConnectionString(): Promise<string> {
        return this.connectionString;
    }

    public async getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus> {
        // Does NOT update treeItem's _webHostingEnabled.
        let serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        let properties: azureStorageBlob.ServiceGetPropertiesResponse = await serviceClient.getProperties();
        let staticWebsite: azureStorageBlob.StaticWebsite | undefined = properties.staticWebsite;

        return {
            capable: !!staticWebsite,
            enabled: !!staticWebsite && staticWebsite.enabled,
            indexDocument: staticWebsite && staticWebsite.indexDocument,
            errorDocument404Path: staticWebsite && staticWebsite.errorDocument404Path
        };
    }

    private createRoot(): IAttachedStorageRoot {
        return {
            storageAccount: this.storageAccount,
            createBlobServiceClient: () => {
                return azureStorageBlob.BlobServiceClient.fromConnectionString(this.connectionString);
            },
            createFileService: () => {
                return new azureStorage.FileService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            },
            createShareServiceClient: () => {
                return azureStorageShare.ShareServiceClient.fromConnectionString(this.connectionString);
            },
            createQueueService: () => {
                return new azureStorage.QueueService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            },
            createTableService: () => {
                return new azureStorage.TableService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            }
        };
    }
}
