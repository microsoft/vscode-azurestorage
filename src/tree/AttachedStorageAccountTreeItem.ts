/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as path from 'path';
import { Uri } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { attachedSuffix, emulatorAccountName, getResourcesPath } from '../constants';
import { localize } from '../utils/localize';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { FileShareGroupTreeItem } from './fileShare/FileShareGroupTreeItem';
import { AttachedStorageRoot, IStorageRoot } from './IStorageRoot';
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
    public static baseContextValue: string = `${StorageAccountTreeItem.contextValue}${attachedSuffix}`;
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
        this._root = new AttachedStorageRoot(connectionString, storageAccountName, this.storageAccountName === emulatorAccountName);
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

        if (!this.root.isEmulated) {
            groupTreeItems.push(this._fileShareGroupTreeItem, this._tableGroupTreeItem);
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

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue !== AttachedStorageAccountTreeItem.baseContextValue || !this.root.isEmulated;
    }
}
