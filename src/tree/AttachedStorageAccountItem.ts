import * as path from 'path';
import * as vscode from 'vscode';
import { emulatorAccountName, emulatorConnectionString, emulatorKey, getResourcesPath } from '../constants';
import { localize } from '../utils/localize';
import { StorageAccountItem } from './StorageAccountItem';
import { IStorageRoot } from './IStorageRoot';
import { AttachedAccountRoot } from './AttachedStorageAccountsTreeItem';
import { getPropertyFromConnectionString } from '../utils/getPropertyFromConnectionString';
import * as azureDataTables from '@azure/data-tables';
import * as azureStorageBlob from '@azure/storage-blob';
import { AccountSASSignatureValues, generateAccountSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorageQueue from '@azure/storage-queue';
import { StorageAccountModel } from './StorageAccountModel';
import { FileShareGroupItem } from './fileShare/FileShareGroupItem';
import { BlobContainerGroupItem } from './blob/BlobContainerGroupItem';
import { createQueueGroupItemFactory, QueueGroupItemFactory } from './queue/QueueGroupItem';
import { TableGroupItem } from './table/TableGroupItem';
import { WebsiteHostingStatus } from './StorageAccountTreeItem';
import { createFileShareItemFactory } from './fileShare/FileShareItem';

export class AttachedStorageAccountItem implements StorageAccountModel {
    public static baseContextValue: string = `${StorageAccountItem.contextValue}-attached`;
    public static emulatedContextValue: string = `${AttachedStorageAccountItem.baseContextValue}-emulated`;

    private readonly root: IStorageRoot;

    constructor(
        public readonly connectionString: string,
        private readonly queueGroupItemFactory: QueueGroupItemFactory,
        private readonly storageAccountName: string) {
        this.root = new AttachedStorageRoot(connectionString, storageAccountName, this.storageAccountName === emulatorAccountName);
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        const children: StorageAccountModel[] = [
            new BlobContainerGroupItem(
                () => this.root.createBlobServiceClient(),
                () => this.getActualWebsiteHostingStatus(),
                this.root,
                'TODO: subscription ID'),
            this.queueGroupItemFactory(this.root)
        ];

        if (!this.root.isEmulated) {
            const shareClientFactory = (shareName: string) => this.root.createShareServiceClient().getShareClient(shareName);
            const fileShareItemFactory = createFileShareItemFactory(
                shareClientFactory,
                {
                    id: this.root.storageAccountId,
                    isEmulated: this.root.isEmulated,
                    subscriptionId: 'TODO: What subscription ID'
                });

            children.push(
                new FileShareGroupItem(
                    fileShareItemFactory,
                    () => this.root.createShareServiceClient()),
                new TableGroupItem(() => this.root.createTableServiceClient())
            );
        }

        return children;
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.root.isEmulated ? localize('localEmulator', 'Local Emulator') : this.storageAccountName, vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = this.root.isEmulated ? AttachedStorageAccountItem.emulatedContextValue : AttachedStorageAccountItem.baseContextValue;
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
        };

        return treeItem;
    }

    private async getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus> {
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

    public createQueueServiceClient(): azureStorageQueue.QueueServiceClient {
        return azureStorageQueue.QueueServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public createTableServiceClient(): azureDataTables.TableServiceClient {
        return azureDataTables.TableServiceClient.fromConnectionString(this._connectionString, { retryOptions: { maxRetries: this._serviceClientPipelineOptions.retryOptions.maxTries } });
    }
}

export type AttachedStorageAccountItemFactory = (connectionString: string, storageAccountName: string) => AttachedStorageAccountItem;

export function createAttachedStorageAccountItemFactory(refresh: (model: StorageAccountModel) => void): AttachedStorageAccountItemFactory {
    return (connectionString: string, storageAccountName: string) => new AttachedStorageAccountItem(connectionString, createQueueGroupItemFactory(refresh), storageAccountName);
}
