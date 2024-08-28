/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccountSASSignatureValues, ServiceGetPropertiesResponse, StaticWebsite } from '@azure/storage-blob';

import { polyfill } from '../polyfill.worker';
polyfill();

import { TableServiceClient } from '@azure/data-tables';
import { BlobServiceClient, generateAccountSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import { ShareServiceClient } from '@azure/storage-file-share';
import { QueueServiceClient } from '@azure/storage-queue';

import { AzExtParentTreeItem, AzExtTreeItem } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { AttachedAccountRoot } from '../AttachedAccountRoot';
import { emulatorAccountName, emulatorConnectionString, emulatorKey, getResourcesPath } from '../constants';
import { getPropertyFromConnectionString } from '../utils/getPropertyFromConnectionString';
import { localize } from '../utils/localize';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { FileShareGroupTreeItem } from './fileShare/FileShareGroupTreeItem';
import { IStorageRoot } from './IStorageRoot';
import { IStorageTreeItem } from './IStorageTreeItem';
import { QueueGroupTreeItem } from './queue/QueueGroupTreeItem';
import { StorageAccountTreeItem, WebsiteHostingStatus } from './StorageAccountTreeItem';
import { TableGroupTreeItem } from './table/TableGroupTreeItem';

export class AttachedStorageAccountTreeItem extends AzExtParentTreeItem implements IStorageTreeItem {
    public childTypeLabel: string = 'resource type';
    public autoSelectInTreeItemPicker: boolean = true;
    public static baseContextValue: string = `${StorageAccountTreeItem.contextValue}-attached`;
    public static emulatedContextValue: string = `${AttachedStorageAccountTreeItem.baseContextValue}-emulated`;

    private readonly _blobContainerGroupTreeItem: BlobContainerGroupTreeItem;
    private readonly _fileShareGroupTreeItem: FileShareGroupTreeItem;
    private readonly _queueGroupTreeItem: QueueGroupTreeItem;
    private readonly _tableGroupTreeItem: TableGroupTreeItem;
    private _root: IStorageRoot;

    constructor(
        parent: AzExtParentTreeItem,
        public readonly connectionString: string,
        private readonly storageAccountName: string) {
        super(parent);

        this.id = this.storageAccountName;
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
        };

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

    // eslint-disable-next-line @typescript-eslint/require-await
    public async loadMoreChildrenImpl(): Promise<AzExtTreeItem[]> {
        const groupTreeItems: AzExtTreeItem[] = [this._blobContainerGroupTreeItem, this._queueGroupTreeItem, this._tableGroupTreeItem];

        if (!this.root.isEmulated) {
            groupTreeItems.push(this._fileShareGroupTreeItem);
        }

        return groupTreeItems;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public getConnectionString(): string {
        return this.connectionString;
    }

    public async getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus> {
        // Does NOT update treeItem's _webHostingEnabled.
        const serviceClient: BlobServiceClient = await this.root.createBlobServiceClient();
        const properties: ServiceGetPropertiesResponse = await serviceClient.getProperties();
        const staticWebsite: StaticWebsite | undefined = properties.staticWebsite;

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

class AttachedStorageRoot extends AttachedAccountRoot {
    public storageAccountName: string;
    public isEmulated: boolean;

    private readonly _serviceClientPipelineOptions = { retryOptions: { maxTries: 2 } };
    private _connectionString: string;

    constructor(connectionString: string, storageAccountName: string, isEmulated: boolean) {
        super();
        this._connectionString = connectionString;
        this.storageAccountName = storageAccountName;
        this.isEmulated = isEmulated;
    }

    public get storageAccountId(): string {
        throw new Error(localize('cannotRetrieveStorageAccountIdForAttachedAccount', 'Cannot retrieve storage account id for an attached account.'));
    }

    public generateSasToken(accountSASSignatureValues: AccountSASSignatureValues): string {
        const key: string | undefined = this._connectionString === emulatorConnectionString ? emulatorKey : getPropertyFromConnectionString(this._connectionString, 'AccountKey');
        if (!key) {
            throw new Error(localize('noKeyConnectionString', 'Could not parse key from connection string'));
        }
        return generateAccountSASQueryParameters(
            accountSASSignatureValues,
            new StorageSharedKeyCredential(this.storageAccountName, key)
        ).toString();
    }

    public async createBlobServiceClient(): Promise<BlobServiceClient> {
        return BlobServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public async createShareServiceClient(): Promise<ShareServiceClient> {
        return ShareServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public async createQueueServiceClient(): Promise<QueueServiceClient> {
        return QueueServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public async createTableServiceClient(): Promise<TableServiceClient> {
        return TableServiceClient.fromConnectionString(this._connectionString, { retryOptions: { maxRetries: this._serviceClientPipelineOptions.retryOptions.maxTries } });
    }
}
