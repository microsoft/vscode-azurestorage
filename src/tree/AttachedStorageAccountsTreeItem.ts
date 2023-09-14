/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { polyfill } from '../polyfill.worker';
polyfill();

import { BlobServiceClient } from "@azure/storage-blob";

import { AzExtParentTreeItem, AzExtTreeItem, IActionContext, ISubscriptionContext, parseError, TreeItemIconPath } from "@microsoft/vscode-azext-utils";
import { ThemeIcon } from 'vscode';
import { AttachedAccountRoot } from '../AttachedAccountRoot';
import { emulatorAccountName, emulatorConnectionString } from '../constants';
import { ext } from '../extensionVariables';
import { getPropertyFromConnectionString } from '../utils/getPropertyFromConnectionString';
import { localize } from '../utils/localize';
import { AttachedStorageAccountTreeItem } from './AttachedStorageAccountTreeItem';
import { StorageAccountTreeItem } from './StorageAccountTreeItem';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';

interface IPersistedAccount {
    fullId: string;
}

export class AttachedStorageAccountsTreeItem extends AzExtParentTreeItem {
    public readonly contextValue: string = 'attachedStorageAccounts';
    public readonly label: string = 'Attached Storage Accounts';
    public childTypeLabel: string = 'Account';

    private _root: ISubscriptionContext;
    private _attachedAccounts: AttachedStorageAccountTreeItem[] | undefined;
    private _loadPersistedAccountsTask: Promise<AttachedStorageAccountTreeItem[]>;
    private readonly _serviceName: string = "ms-azuretools.vscode-azurestorage.connectionStrings2";

    constructor(parent: AzExtParentTreeItem) {
        super(parent);
        this.id = 'attachedStorageAccounts';
        this._root = new AttachedAccountRoot();
        this._loadPersistedAccountsTask = this.loadPersistedAccounts();
    }

    public get root(): ISubscriptionContext {
        return this._root;
    }

    public get iconPath(): TreeItemIconPath {
        return new ThemeIcon('plug');
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

    public async attachWithConnectionString(context: IActionContext): Promise<void> {
        const connectionString = await context.ui.showInputBox({
            prompt: localize('enterConnectionString', 'Enter the connection string for your storage account'),
            validateInput: (value: string): string | undefined => this.validateConnectionString(value)
        });

        const accountName: string = getPropertyFromConnectionString(connectionString, 'AccountName') || emulatorAccountName;

        await this.attachAccount(this.createTreeItem(connectionString, accountName));
        await ext.rgApi.workspaceResourceTree.refresh(context, ext.attachedStorageAccountsTreeItem);
    }

    public async detach(treeItem: AttachedStorageAccountTreeItem): Promise<void> {
        const attachedAccounts: AttachedStorageAccountTreeItem[] = await this.getAttachedAccounts();

        const index = attachedAccounts.findIndex((account) => account.fullId === treeItem.fullId);
        if (index !== -1) {
            attachedAccounts.splice(index, 1);
            await ext.context.secrets.delete(this.getAccountKey(treeItem));
            await this.persistIds(attachedAccounts);
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

            if (treeItem.root.storageAccountName !== emulatorAccountName) {
                await ext.context.secrets.store(this.getAccountKey(treeItem), treeItem.getConnectionString());
                await this.persistIds(attachedAccounts);
            }
        }
    }

    private async loadPersistedAccounts(): Promise<AttachedStorageAccountTreeItem[]> {
        const persistedAccounts: AttachedStorageAccountTreeItem[] = [];
        const value: string | undefined = ext.context.globalState.get(this._serviceName);
        let connectionString: string;

        if (value) {
            const accounts: IPersistedAccount[] = <IPersistedAccount[]>JSON.parse(value);
            await Promise.all(accounts.map(async account => {
                connectionString = <string>await ext.context.secrets.get(this.getAccountKey(account));
                const accountName: string | undefined = getPropertyFromConnectionString(connectionString, 'AccountName');

                if (accountName) {
                    persistedAccounts.push(this.createTreeItem(connectionString, accountName));
                }
            }));
        }

        persistedAccounts.push(this.createTreeItem(emulatorConnectionString, emulatorAccountName));
        return persistedAccounts;
    }

    private createTreeItem(connectionString: string, name: string): AttachedStorageAccountTreeItem {
        return new AttachedStorageAccountTreeItem(this, connectionString, name);
    }

    private async persistIds(attachedAccounts: AttachedStorageAccountTreeItem[]): Promise<void> {
        const value: IPersistedAccount[] = [];
        for (const treeItem of attachedAccounts) {
            if (treeItem.root.storageAccountName !== emulatorAccountName) {
                value.push(<IPersistedAccount>{
                    fullId: treeItem.fullId,
                });
            }
        }

        await ext.context.globalState.update(this._serviceName, JSON.stringify(value));
    }

    private validateConnectionString(connectionString: string): string | undefined {
        if (connectionString.length > 0) {
            try {
                // Attempt to use the connection string
                BlobServiceClient.fromConnectionString(connectionString);
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

    private getAccountKey(account: IPersistedAccount): string {
        return this._serviceName + account.fullId;
    }
}
