import * as azureDataTables from '@azure/data-tables';
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath, maxPageSize } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";
import { TableItem } from './TableItem';

export class TableGroupItem implements StorageAccountModel {
    constructor(private readonly tableServiceClientFactory: () => azureDataTables.TableServiceClient) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const tables = await this.listAllTables();

        return tables
            .filter(table => table.name !== undefined)
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .map(table => new TableItem(table.name!));
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Tables', vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureTable.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureTable.svg')
        };

        return treeItem;
    }

    private async listAllTables(): Promise<azureDataTables.TableItem[]> {
        let response: azureDataTables.TableItemResultPage | undefined;

        const queues: azureDataTables.TableItem[] = [];

        do {
            response = await this.listTables(response?.continuationToken);

            if (response) {
                queues.push(...response);
            }
        } while (response.continuationToken);

        return queues;
    }

    private async listTables(continuationToken?: string): Promise<azureDataTables.TableItemResultPage> {
        const tableServiceClient = this.tableServiceClientFactory();
        const response: AsyncIterableIterator<azureDataTables.TableItemResultPage> = tableServiceClient.listTables().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }
}
