import * as azureStorageShare from '@azure/storage-file-share';
import * as vscode from 'vscode';
import * as path from 'path';
import { getResourcesPath, maxPageSize } from '../../constants';
import { StorageAccountModel } from "../StorageAccountModel";
import { parseError } from '@microsoft/vscode-azext-utils';
import { localize } from '../../utils/localize';
import { FileShareItemFactory } from './FileShareItem';

export class FileShareGroupItem implements StorageAccountModel {
    constructor(
        private readonly fileShareItemFactory: FileShareItemFactory,
        private readonly shareServiceClientFactory: () => azureStorageShare.ShareServiceClient) {
    }

    async getChildren(): Promise<StorageAccountModel[]> {
        const shares = await this.listAllShares();

        return shares.map(share => this.fileShareItemFactory(share.name));
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('File Shares', vscode.TreeItemCollapsibleState.Collapsed);

        treeItem.contextValue = 'azureFileShareGroup';
        treeItem.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureFileShare.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureFileShare.svg')
        };

        return treeItem;
    }

    async listAllShares(): Promise<azureStorageShare.ShareItem[]> {
        let response: azureStorageShare.ServiceListSharesSegmentResponse | undefined;

        const shares: azureStorageShare.ShareItem[] = [];

        do {
            response = await this.listShares(response?.continuationToken);

            if (response.shareItems) {
                shares.push(...response.shareItems);
            }
        } while (response.continuationToken);

        return shares;
    }

    async listShares(continuationToken?: string): Promise<azureStorageShare.ServiceListSharesSegmentResponse> {
        const shareServiceClient: azureStorageShare.ShareServiceClient = this.shareServiceClientFactory();
        const response: AsyncIterableIterator<azureStorageShare.ServiceListSharesSegmentResponse> = shareServiceClient.listShares().byPage({ continuationToken, maxPageSize });

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return (await response.next()).value;
        } catch (error) {
            if (parseError(error).errorType === 'REQUEST_SEND_ERROR') {
                throw new Error(localize('storageAccountDoesNotSupportFileShares', 'This storage account does not support file shares.'));
            } else {
                throw error;
            }
        }
    }
}
