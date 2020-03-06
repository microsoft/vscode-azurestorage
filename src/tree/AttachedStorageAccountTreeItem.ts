/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri } from 'vscode';
import { AzExtParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { getResourcesPath } from '../constants';
import { StorageAccountWrapper } from '../utils/storageWrappers';
import { AttachedStorageAccountsTreeItem } from './AttachedStorageAccountsTreeItem';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { FileShareGroupTreeItem } from './fileShare/FileShareGroupTreeItem';
import { IAttachedStorageRoot, IStorageRoot } from './IStorageRoot';
import { QueueGroupTreeItem } from './queue/QueueGroupTreeItem';
import { StorageAccountTreeItem, WebsiteHostingStatus } from './StorageAccountTreeItem';
import { TableGroupTreeItem } from './table/TableGroupTreeItem';

const attachedAccountSuffix: string = 'Attached';

export class AttachedStorageAccountTreeItem extends AzExtParentTreeItem {
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
    };
    public childTypeLabel: string = 'resource type';
    public autoSelectInTreeItemPicker: boolean = true;
    public id: string = this.storageAccount.id;
    public label: string = this.storageAccount.name;
    public static contextValue: string = `${StorageAccountTreeItem.contextValue}${attachedAccountSuffix}`;
    public contextValue: string = AttachedStorageAccountTreeItem.contextValue;

    private readonly _blobContainerGroupTreeItem: BlobContainerGroupTreeItem;
    private readonly _fileShareGroupTreeItem: FileShareGroupTreeItem;
    private readonly _queueGroupTreeItem: QueueGroupTreeItem;
    private readonly _tableGroupTreeItem: TableGroupTreeItem;
    private _root: IAttachedStorageRoot;

    constructor(
        parent: AzExtParentTreeItem,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly connectionString: string) {
        super(parent);
        this._root = this.createRoot();
        this._blobContainerGroupTreeItem = new BlobContainerGroupTreeItem(this);
        this._fileShareGroupTreeItem = new FileShareGroupTreeItem(this);
        this._queueGroupTreeItem = new QueueGroupTreeItem(this);
        this._tableGroupTreeItem = new TableGroupTreeItem(this);
    }

    public get root(): IAttachedStorageRoot {
        return this._root;
    }

    public async loadMoreChildrenImpl(): Promise<AzureTreeItem<IStorageRoot>[]> {
        const blobClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        const blobContainersActive: boolean = await this.taskResolvesBeforeTimeout(blobClient.getProperties());

        const queueService: azureStorage.QueueService = this.root.createQueueService();
        const queueTask: Promise<void> = new Promise((resolve, reject) => {
            // tslint:disable-next-line:no-any
            queueService.getServiceProperties({}, (err?: any) => {
                err ? reject(err) : resolve();
            });
        });
        const queuesActive: boolean = await this.taskResolvesBeforeTimeout(queueTask);

        let groupTreeItems: AzureTreeItem<IStorageRoot>[] = [];
        if (this.connectionString === AttachedStorageAccountsTreeItem.emulatorConnectionString) {
            // Emulated accounts always include blob containers and queues regardless of if they're active or not
            this._blobContainerGroupTreeItem.active = blobContainersActive;
            groupTreeItems.push(this._blobContainerGroupTreeItem);

            this._queueGroupTreeItem.active = queuesActive;
            groupTreeItems.push(this._queueGroupTreeItem);
        } else {
            if (blobContainersActive) {
                groupTreeItems.push(this._blobContainerGroupTreeItem);
            }

            if (queuesActive) {
                groupTreeItems.push(this._queueGroupTreeItem);
            }

            const shareClient: azureStorageShare.ShareServiceClient = this.root.createShareServiceClient();
            if (await this.taskResolvesBeforeTimeout(shareClient.getProperties())) {
                groupTreeItems.push(this._fileShareGroupTreeItem);
            }

            const tableService: azureStorage.TableService = this.root.createTableService();
            const tableTask: Promise<void> = new Promise((resolve, reject) => {
                // Getting table service properties will succeed even when tables aren't supported, so attempt to list tables instead
                // tslint:disable-next-line:no-any
                tableService.listTablesSegmented(<azureStorage.TableService.ListTablesContinuationToken><unknown>undefined, (err?: any) => {
                    err ? reject(err) : resolve();
                });
            });
            if (await this.taskResolvesBeforeTimeout(tableTask)) {
                groupTreeItems.push(this._tableGroupTreeItem);
            }
        }

        return groupTreeItems;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async getConnectionString(): Promise<string> {
        return this.connectionString;
    }

    public async getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus> {
        // Does NOT update treeItem's _webHostingEnabled.
        let serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        let properties: azureStorageBlob.ServiceGetPropertiesResponse = await serviceClient.getProperties();
        let staticWebsite: azureStorageBlob.StaticWebsite | undefined = properties.staticWebsite;

        return {
            capable: !!staticWebsite,
            enabled: !!staticWebsite && staticWebsite.enabled,
            indexDocument: staticWebsite && staticWebsite.indexDocument,
            errorDocument404Path: staticWebsite && staticWebsite.errorDocument404Path
        };
    }

    private createRoot(): IAttachedStorageRoot {
        return {
            storageAccount: this.storageAccount,
            createBlobServiceClient: () => {
                return azureStorageBlob.BlobServiceClient.fromConnectionString(this.connectionString);
            },
            createFileService: () => {
                return new azureStorage.FileService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            },
            createShareServiceClient: () => {
                return azureStorageShare.ShareServiceClient.fromConnectionString(this.connectionString);
            },
            createQueueService: () => {
                return new azureStorage.QueueService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            },
            createTableService: () => {
                return new azureStorage.TableService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            }
        };
    }

    // tslint:disable-next-line:no-any
    private async taskResolvesBeforeTimeout(promise: any): Promise<boolean> {
        let timeout = new Promise((_resolve, reject) => {
            let id = setTimeout(() => {
                clearTimeout(id);
                reject();
                // tslint:disable-next-line:align
            }, 1000);
        });

        try {
            await Promise.race([
                promise,
                timeout
            ]);
            return true;
        } catch {
            return false;
        }
    }
}
