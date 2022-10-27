import * as path from 'path';
import * as vscode from 'vscode';
import { getResourcesPath } from '../../constants';
import { IStorageRoot } from '../IStorageRoot';
import { StorageAccountModel } from "../StorageAccountModel";
import { TableItem } from './TableItem';
import { listAllTables } from './tableUtils';

export class TableGroupItem implements StorageAccountModel {
    constructor(
        public readonly storageRoot: IStorageRoot,
        public readonly subscriptionId: string,
        public readonly refresh: (model: StorageAccountModel) => void) {
    }

    readonly notifyCreated = (): void => this.refresh(this);

    async getChildren(): Promise<StorageAccountModel[]> {
        const tables = await listAllTables(() => this.storageRoot.createTableServiceClient());

        return tables
            .filter(table => table.name !== undefined)
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .map(table => new TableItem(table.name!, this.storageRoot, this.subscriptionId, () => this.refresh(this)));
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Tables', vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureTableGroup';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureTable.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureTable.svg')
        };

        return treeItem;
    }
}
