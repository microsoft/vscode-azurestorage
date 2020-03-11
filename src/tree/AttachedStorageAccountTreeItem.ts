/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, ISubscriptionContext } from 'vscode-azureextensionui';
import { emulatorAccountName, emulatorConnectionString, getResourcesPath } from '../constants';
import { localize } from '../utils/localize';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { FileShareGroupTreeItem } from './fileShare/FileShareGroupTreeItem';
import { IStorageRoot } from './IStorageRoot';
import { QueueGroupTreeItem } from './queue/QueueGroupTreeItem';
import { StorageAccountTreeItem, WebsiteHostingStatus } from './StorageAccountTreeItem';
import { TableGroupTreeItem } from './table/TableGroupTreeItem';

export class AttachedStorageAccountTreeItem extends AzureParentTreeItem {
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
    };
    public childTypeLabel: string = 'resource type';
    public autoSelectInTreeItemPicker: boolean = true;
    public id: string = this.storageAccountName;
    public static baseContextValue: string = `${StorageAccountTreeItem.contextValue}-attached`;
    public static emulatedContextValue: string = `${AttachedStorageAccountTreeItem.baseContextValue}-emulated`;

    private readonly _blobContainerGroupTreeItem: BlobContainerGroupTreeItem;
    private readonly _fileShareGroupTreeItem: FileShareGroupTreeItem;
    private readonly _queueGroupTreeItem: QueueGroupTreeItem;
    private readonly _tableGroupTreeItem: TableGroupTreeItem;
    private _root: IStorageRoot;

    constructor(
        parent: AzureParentTreeItem,
        public readonly connectionString: string,
        private readonly storageAccountName: string) {
        super(parent);
        this._root = this.createRoot(parent.root);
        this._blobContainerGroupTreeItem = new BlobContainerGroupTreeItem(this);
        this._fileShareGroupTreeItem = new FileShareGroupTreeItem(this);
        this._queueGroupTreeItem = new QueueGroupTreeItem(this);
        this._tableGroupTreeItem = new TableGroupTreeItem(this);
    }

    public get root(): IStorageRoot {
        return this._root;
    }

    public get label(): string {
        return this.root.isEmulated ? localize('localEmulator', 'Local Emulator') : this.storageAccountName;
    }

    public get contextValue(): string {
        return this.root.isEmulated ? AttachedStorageAccountTreeItem.emulatedContextValue : AttachedStorageAccountTreeItem.baseContextValue;
    }

    public async loadMoreChildrenImpl(): Promise<AzureTreeItem<IStorageRoot>[]> {
        let groupTreeItems: AzureTreeItem<IStorageRoot>[] = [this._blobContainerGroupTreeItem, this._queueGroupTreeItem];

        if (this.connectionString === emulatorConnectionString) {
            this._blobContainerGroupTreeItem.active = await this._blobContainerGroupTreeItem.isActive();
            this._queueGroupTreeItem.active = await this._queueGroupTreeItem.isActive();
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

    private createRoot(subRoot: ISubscriptionContext): IStorageRoot {
        const serviceClientPipelineOptions = { retryOptions: { maxTries: 2 } };

        return Object.assign({}, subRoot, {
            storageAccountName: this.storageAccountName,
            storageAccountId: this.storageAccountName,
            isEmulated: this.storageAccountName === emulatorAccountName,
            createBlobServiceClient: () => {
                return azureStorageBlob.BlobServiceClient.fromConnectionString(this.connectionString, serviceClientPipelineOptions);
            },
            createFileService: () => {
                return new azureStorage.FileService(this.connectionString);
            },
            createShareServiceClient: () => {
                return azureStorageShare.ShareServiceClient.fromConnectionString(this.connectionString, serviceClientPipelineOptions);
            },
            createQueueService: () => {
                return new azureStorage.QueueService(this.connectionString);
            },
            createTableService: () => {
                return new azureStorage.TableService(this.connectionString);
            }
        });
    }
}
