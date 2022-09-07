import * as vscode from 'vscode';
import { StorageWorkspaceModel } from './StorageWorkspaceModel';
import { localize } from '../../utils/localize';
import { AttachedStorageAccountItem } from './AttachedStorageAccountItem';
import { KeyTar, tryGetKeyTar } from '../../utils/keytar';
import { getPropertyFromConnectionString } from '../../utils/getPropertyFromConnectionString';
import { emulatorAccountName, emulatorConnectionString } from '../../constants';
import { ext } from '../../extensionVariables';

interface IPersistedAccount {
    fullId: string;
}

export class AttachedStorageAccountsItem implements StorageWorkspaceModel {
    private readonly _serviceName: string = "ms-azuretools.vscode-azurestorage.connectionStrings";
    private readonly _keytar: KeyTar | undefined;

    constructor() {
        this._keytar = tryGetKeyTar();
    }

    getChildren(): vscode.ProviderResult<StorageWorkspaceModel[]> {
        return this.getAttachedAccounts();
    }

    getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem('Attached Storage Accounts', vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'attachedStorageAccounts';
        treeItem.iconPath = new vscode.ThemeIcon('plug');

        return treeItem;
    }

    private async getAttachedAccounts(): Promise<AttachedStorageAccountItem[]> {
        try {
            return await this.loadPersistedAccounts();
        } catch {
            throw new Error(localize('failedToLoadPersistedStorageAccounts', 'Failed to load persisted Storage Accounts. Accounts must be reattached manually.'));
        }
    }

    private async loadPersistedAccounts(): Promise<AttachedStorageAccountItem[]> {
        const persistedAccounts: AttachedStorageAccountItem[] = [];
        const value: string | undefined = ext.context.globalState.get(this._serviceName);
        let connectionString: string;

        if (value && this._keytar) {
            const accounts: IPersistedAccount[] = <IPersistedAccount[]>JSON.parse(value);
            await Promise.all(accounts.map(async account => {
                connectionString = <string>(this._keytar && await this._keytar.getPassword(this._serviceName, account.fullId));
                const accountName: string | undefined = getPropertyFromConnectionString(connectionString, 'AccountName');

                if (accountName) {
                    persistedAccounts.push(this.createTreeItem(connectionString, accountName));
                }
            }));
        }

        persistedAccounts.push(this.createTreeItem(emulatorConnectionString, emulatorAccountName));
        return persistedAccounts;
    }

    private createTreeItem(connectionString: string, name: string): AttachedStorageAccountItem {
        return new AttachedStorageAccountItem(connectionString, name);
    }
}
