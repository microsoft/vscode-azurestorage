/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import { AccountSASSignatureValues, generateAccountSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { emulatorAccountName, emulatorConnectionString, emulatorKey, getResourcesPath } from '../constants';
import { getPropertyFromConnectionString } from '../utils/getPropertyFromConnectionString';
import { localize } from '../utils/localize';
import { AttachedAccountRoot } from './AttachedStorageAccountsTreeItem';
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
    public async loadMoreChildrenImpl(): Promise<AzureTreeItem<IStorageRoot>[]> {
        const groupTreeItems: AzureTreeItem<IStorageRoot>[] = [this._blobContainerGroupTreeItem, this._queueGroupTreeItem];

        if (!this.root.isEmulated) {
            groupTreeItems.push(this._fileShareGroupTreeItem, this._tableGroupTreeItem);
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
        const serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        const properties: azureStorageBlob.ServiceGetPropertiesResponse = await serviceClient.getProperties();
        const staticWebsite: azureStorageBlob.StaticWebsite | undefined = properties.staticWebsite;

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

    public createBlobServiceClient(): azureStorageBlob.BlobServiceClient {
        return azureStorageBlob.BlobServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public createShareServiceClient(): azureStorageShare.ShareServiceClient {
        return azureStorageShare.ShareServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public createQueueService(): azureStorage.QueueService {
        return new azureStorage.QueueService(this._connectionString);
    }

    public createTableService(): azureStorage.TableService {
        return new azureStorage.TableService(this._connectionString);
    }
}
