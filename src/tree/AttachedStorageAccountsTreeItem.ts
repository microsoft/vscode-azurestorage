/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import * as path from 'path';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem } from "vscode-azureextensionui";
import { getResourcesPath } from '../constants';
import { ext } from '../extensionVariables';
import { KeyTar, tryGetKeyTar } from '../utils/keytar';
import { localize } from '../utils/localize';
import { StorageAccountWrapper } from '../utils/storageWrappers';
import { AttachedStorageAccountTreeItem } from './AttachedStorageAccountTreeItem';

interface IPersistedAccount {
    fullId: string;
    name: string;
}

export class AttachedStorageAccountsTreeItem extends AzExtParentTreeItem {
    public readonly contextValue: string = 'attachedStorageAccounts';
    public readonly id: string = 'attachedStorageAccounts';
    public readonly label: string = 'Attached Storage Accounts';
    public childTypeLabel: string = 'Account';
    public static emulatorConnectionString: string = 'UseDevelopmentStorage=true;';

    private _attachedAccounts: AttachedStorageAccountTreeItem[] | undefined;
    private _loadPersistedAccountsTask: Promise<AttachedStorageAccountTreeItem[]>;
    private _keytar: KeyTar | undefined;
    private readonly _serviceName: string = "ms-azuretools.vscode-azurestorage.connectionStrings";
    private readonly _storageAccountType: string = 'Microsoft.Storage/storageAccounts';
    private readonly _emulatorAccountName: string = 'devstoreaccount1';

    constructor(parent: AzExtParentTreeItem) {
        super(parent);
        this._keytar = tryGetKeyTar();
        // tslint:disable-next-line: no-use-before-declare
        this._loadPersistedAccountsTask = this.loadPersistedAccounts();
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
        }

        const attachedAccounts: AttachedStorageAccountTreeItem[] = await this.getAttachedAccounts();

        if (attachedAccounts.length === 0) {
            return [new GenericTreeItem(this, {
                contextValue: 'azureStorageAttachAccount',
                label: 'Attach Storage Account...',
                commandId: 'azureStorage.attachStorageAccount',
                includeInTreeItemPicker: false
            })];
        }

        return attachedAccounts;
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === (AttachedStorageAccountTreeItem.contextValue);
    }

    public async attachEmulator(): Promise<void> {
        await this.attachAccount(await this.createTreeItem(AttachedStorageAccountsTreeItem.emulatorConnectionString, this._emulatorAccountName));
        await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
    }

    public async attachWithConnectionString(): Promise<void> {
        const connectionString = await vscode.window.showInputBox({
            prompt: localize('enterConnectionString', 'Enter the connection string for your storage account'),
            ignoreFocusOut: true,
            validateInput: (value: string): string | undefined => this.validateConnectionString(value)
        });

        if (connectionString) {
            try {
                // Attempt to use the connection string
                azureStorageBlob.BlobServiceClient.fromConnectionString(connectionString);
            } catch {
                throw new Error(localize('couldNotAttachStorageAccountWithProvidedConnectionString', 'Could not attach storage account with provided connection string.'));
            }

            let accountName: string = this.getPropertyFromConnectionString(connectionString, 'AccountName') || this._emulatorAccountName;

            await this.attachAccount(await this.createTreeItem(connectionString, accountName));
            await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
        }
    }

    public async detach(treeItem: AttachedStorageAccountTreeItem): Promise<void> {
        const attachedAccounts: AttachedStorageAccountTreeItem[] = await this.getAttachedAccounts();

        const index = attachedAccounts.findIndex((account) => account.fullId === treeItem.fullId);
        if (index !== -1) {
            attachedAccounts.splice(index, 1);
            if (this._keytar) {
                if (treeItem.storageAccount.name !== this._emulatorAccountName) {
                    await this._keytar.deletePassword(this._serviceName, treeItem.fullId);
                }

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
            vscode.window.showWarningMessage(localize('storageAccountIsAlreadyAttached', `Storage Account '${treeItem.id}' is already attached.`));
        } else {
            attachedAccounts.push(treeItem);

            if (this._keytar && treeItem.storageAccount.name !== this._emulatorAccountName) {
                await this._keytar.setPassword(this._serviceName, treeItem.fullId, await treeItem.getConnectionString());
            }

            await this.persistIds(attachedAccounts);
        }
    }

    private async loadPersistedAccounts(): Promise<AttachedStorageAccountTreeItem[]> {
        const persistedAccounts: AttachedStorageAccountTreeItem[] = [];
        const value: string | undefined = ext.context.globalState.get(this._serviceName);
        let connectionString: string;

        if (value && this._keytar) {
            const accounts: IPersistedAccount[] = <IPersistedAccount[]>JSON.parse(value);
            await Promise.all(accounts.map(async account => {
                if (account.name === this._emulatorAccountName) {
                    connectionString = AttachedStorageAccountsTreeItem.emulatorConnectionString;
                } else {
                    connectionString = <string>(this._keytar && await this._keytar.getPassword(this._serviceName, account.fullId));
                }

                persistedAccounts.push(await this.createTreeItem(connectionString, account.name));
            }));
        }

        return persistedAccounts;
    }

    // tslint:disable-next-line:no-reserved-keywords
    private async createTreeItem(connectionString: string, name: string): Promise<AttachedStorageAccountTreeItem> {
        let storageAccountWrapper: StorageAccountWrapper = new StorageAccountWrapper(<StorageAccount>{
            id: this.getAttachedAccountId(name),
            type: this._storageAccountType,
            name,
            primaryEndpoints: {
                blob: '',
                file: '',
                queue: '',
                table: ''
            }
        });
        return new AttachedStorageAccountTreeItem(this, storageAccountWrapper, connectionString);
    }

    private async persistIds(attachedAccounts: AttachedStorageAccountTreeItem[]): Promise<void> {
        const value: IPersistedAccount[] = attachedAccounts.map((treeItem: AttachedStorageAccountTreeItem) => {
            return <IPersistedAccount>{
                fullId: treeItem.fullId,
                name: treeItem.storageAccount.name,
            };
        });
        await ext.context.globalState.update(this._serviceName, JSON.stringify(value));
    }

    private getAttachedAccountId(name: string): string {
        return `/subscriptions/attached/resourceGroups/attached/providers/Microsoft.Storage/storageAccounts/${name}`;
    }

    private getPropertyFromConnectionString(connectionString: string, property: string): string | undefined {
        const regexp: RegExp = new RegExp(`(?:^|;)\\s*${property}=([^;]+)(?:;|$)`, 'i');
        // tslint:disable-next-line: strict-boolean-expressions
        const match: RegExpMatchArray | undefined = connectionString.match(regexp) || undefined;
        return match && match[1];
    }

    private validateConnectionString(connectionString: string): string | undefined {
        if (connectionString.includes('DefaultEndpointsProtocol') &&
            connectionString.includes('AccountName') &&
            connectionString.includes('AccountKey')) {
            return undefined;
        }

        if (connectionString === AttachedStorageAccountsTreeItem.emulatorConnectionString) {
            return undefined;
        }

        return `Connection string must match format "DefaultEndpointsProtocol=...;AccountName=...;AccountKey=...;" or "${AttachedStorageAccountsTreeItem.emulatorConnectionString}"`;
    }
}
