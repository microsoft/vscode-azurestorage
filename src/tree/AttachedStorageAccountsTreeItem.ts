/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import * as path from 'path';
import { Uri } from 'vscode';
import { AzExtParentTreeItem, AzExtTreeItem, AzureParentTreeItem, ISubscriptionContext, parseError } from "vscode-azureextensionui";
import { emulatorAccountName, emulatorConnectionString, getResourcesPath } from '../constants';
import { ext } from '../extensionVariables';
import { KeyTar, tryGetKeyTar } from '../utils/keytar';
import { localize } from '../utils/localize';
import { AttachedStorageAccountTreeItem } from './AttachedStorageAccountTreeItem';
import { StorageAccountTreeItem } from './StorageAccountTreeItem';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';

interface IPersistedAccount {
    fullId: string;
}

export class AttachedStorageAccountsTreeItem extends AzureParentTreeItem {
    public readonly contextValue: string = 'attachedStorageAccounts';
    public readonly id: string = 'attachedStorageAccounts';
    public readonly label: string = 'Attached Storage Accounts';
    public childTypeLabel: string = 'Account';

    private _root: ISubscriptionContext;
    private _attachedAccounts: AttachedStorageAccountTreeItem[] | undefined;
    private _loadPersistedAccountsTask: Promise<AttachedStorageAccountTreeItem[]>;
    private _keytar: KeyTar | undefined;
    private readonly _serviceName: string = "ms-azuretools.vscode-azurestorage.connectionStrings";

    constructor(parent: AzExtParentTreeItem) {
        super(parent);
        this._keytar = tryGetKeyTar();
        // tslint:disable-next-line: no-use-before-declare
        this._root = new AttachedAccountRoot();
        this._loadPersistedAccountsTask = this.loadPersistedAccounts();
    }

    public get root(): ISubscriptionContext {
        return this._root;
    }

    public get iconPath(): { light: string | Uri; dark: string | Uri } {
        return {
            light: path.join(getResourcesPath(), 'light', 'ConnectPlugged.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'ConnectPlugged.svg')
        };
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._attachedAccounts = undefined;
            this._loadPersistedAccountsTask = this.loadPersistedAccounts();
        }

        return await this.getAttachedAccounts();
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue !== StorageAccountTreeItem.contextValue && contextValue !== SubscriptionTreeItem.contextValue;
    }

    public async attachWithConnectionString(): Promise<void> {
        const connectionString = await ext.ui.showInputBox({
            prompt: localize('enterConnectionString', 'Enter the connection string for your storage account'),
            validateInput: (value: string): string | undefined => this.validateConnectionString(value)
        });

        let accountName: string = this.getPropertyFromConnectionString(connectionString, 'AccountName') || emulatorAccountName;

        await this.attachAccount(await this.createTreeItem(connectionString, accountName));
        await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
    }

    public async detach(treeItem: AttachedStorageAccountTreeItem): Promise<void> {
        const attachedAccounts: AttachedStorageAccountTreeItem[] = await this.getAttachedAccounts();

        const index = attachedAccounts.findIndex((account) => account.fullId === treeItem.fullId);
        if (index !== -1) {
            attachedAccounts.splice(index, 1);
            if (this._keytar) {
                await this._keytar.deletePassword(this._serviceName, treeItem.fullId);
                await this.persistIds(attachedAccounts);
            }
        }
    }

    private async getAttachedAccounts(): Promise<AttachedStorageAccountTreeItem[]> {
        if (!this._attachedAccounts) {
            try {
                this._attachedAccounts = await this._loadPersistedAccountsTask;
            } catch {
                this._attachedAccounts = [];
                throw new Error(localize('failedToLoadPersistedStorageAccounts', 'Failed to load persisted Storage Accounts. Accounts must be reattached manually.'));
            }
        }

        return this._attachedAccounts;
    }

    private async attachAccount(treeItem: AttachedStorageAccountTreeItem): Promise<void> {
        const attachedAccounts: AttachedStorageAccountTreeItem[] = await this.getAttachedAccounts();

        if (attachedAccounts.find(s => s.fullId === treeItem.fullId)) {
            throw new Error(localize('storageAccountIsAlreadyAttached', 'Storage Account "{0}" is already attached.', treeItem.id));
        } else {
            attachedAccounts.push(treeItem);

            if (this._keytar && treeItem.root.storageAccountName !== emulatorAccountName) {
                await this._keytar.setPassword(this._serviceName, treeItem.fullId, await treeItem.getConnectionString());
                await this.persistIds(attachedAccounts);
            }
        }
    }

    private async loadPersistedAccounts(): Promise<AttachedStorageAccountTreeItem[]> {
        const persistedAccounts: AttachedStorageAccountTreeItem[] = [];
        const value: string | undefined = ext.context.globalState.get(this._serviceName);
        let connectionString: string;

        if (value && this._keytar) {
            const accounts: IPersistedAccount[] = <IPersistedAccount[]>JSON.parse(value);
            await Promise.all(accounts.map(async account => {
                connectionString = <string>(this._keytar && await this._keytar.getPassword(this._serviceName, account.fullId));
                let accountName: string | undefined = this.getPropertyFromConnectionString(connectionString, 'AccountName');

                if (accountName) {
                    persistedAccounts.push(await this.createTreeItem(connectionString, accountName));
                }
            }));
        }

        persistedAccounts.push(await this.createTreeItem(emulatorConnectionString, emulatorAccountName));
        return persistedAccounts;
    }

    private async createTreeItem(connectionString: string, name: string): Promise<AttachedStorageAccountTreeItem> {
        return new AttachedStorageAccountTreeItem(this, connectionString, name);
    }

    private async persistIds(attachedAccounts: AttachedStorageAccountTreeItem[]): Promise<void> {
        let value: IPersistedAccount[] = [];
        for (let treeItem of attachedAccounts) {
            if (treeItem.root.storageAccountName !== emulatorAccountName) {
                value.push(<IPersistedAccount>{
                    fullId: treeItem.fullId,
                });
            }
        }

        await ext.context.globalState.update(this._serviceName, JSON.stringify(value));
    }

    private getPropertyFromConnectionString(connectionString: string, property: string): string | undefined {
        const regexp: RegExp = new RegExp(`(?:^|;)\\s*${property}=([^;]+)(?:;|$)`, 'i');
        // tslint:disable-next-line: strict-boolean-expressions
        const match: RegExpMatchArray | undefined = connectionString.match(regexp) || undefined;
        return match && match[1];
    }

    private validateConnectionString(connectionString: string): string | undefined {
        if (connectionString.length > 0) {
            try {
                // Attempt to use the connection string
                azureStorageBlob.BlobServiceClient.fromConnectionString(connectionString);
            } catch (error) {
                return parseError(error).message;
            }
        }

        if (connectionString === emulatorConnectionString) {
            return localize('emulatorAlreadyAttached', 'Local emulator is already attached.');
        }

        if (connectionString.includes('DefaultEndpointsProtocol') &&
            connectionString.includes('AccountName') &&
            connectionString.includes('AccountKey')) {
            return undefined;
        }

        return localize('connectionStringMustMatchFormat', 'Connection string must match format "DefaultEndpointsProtocol=...;AccountName=...;AccountKey=...;"');
    }
}

export class AttachedAccountRoot implements ISubscriptionContext {
    private _error: Error = new Error(localize('cannotRetrieveAzureSubscriptionInfoForAttachedAccount', 'Cannot retrieve Azure subscription information for an attached account.'));

    public get credentials(): ServiceClientCredentials {
        throw this._error;
    }

    public get subscriptionDisplayName(): string {
        throw this._error;
    }

    public get subscriptionId(): string {
        throw this._error;
    }

    public get subscriptionPath(): string {
        throw this._error;
    }

    public get tenantId(): string {
        throw this._error;
    }

    public get userId(): string {
        throw this._error;
    }

    public get environment(): AzureEnvironment {
        throw this._error;
    }
}
