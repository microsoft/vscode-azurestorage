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

export class AttachedStorageAccountItem implements StorageAccountModel {
    public static baseContextValue: string = `${StorageAccountItem.contextValue}-attached`;
    public static emulatedContextValue: string = `${AttachedStorageAccountItem.baseContextValue}-emulated`;

    private readonly root: IStorageRoot;

    constructor(
        public readonly connectionString: string,
        private readonly storageAccountName: string) {
        this.root = new AttachedStorageRoot(connectionString, storageAccountName, this.storageAccountName === emulatorAccountName);
    }

    getChildren(): vscode.ProviderResult<StorageAccountModel[]> {
        return [];
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(this.root.isEmulated ? localize('localEmulator', 'Local Emulator') : this.storageAccountName);

        treeItem.contextValue = this.root.isEmulated ? AttachedStorageAccountItem.emulatedContextValue : AttachedStorageAccountItem.baseContextValue;
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
        };

        return treeItem;
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
