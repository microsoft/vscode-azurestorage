/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccountKey } from 'azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
// tslint:disable-next-line:no-require-imports
import opn = require('opn');
import * as path from 'path';
import { commands, MessageItem, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, createAzureClient, DialogResponses, IActionContext, ISubscriptionContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath, staticWebsiteContainerName } from '../constants';
import { ext } from "../extensionVariables";
import { nonNullProp } from '../utils/nonNull';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from '../utils/storageWrappers';
import { attachedAccountSuffix, AttachedStorageAccountsTreeItem } from './AttachedStorageAccountsTreeItem';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { BlobContainerTreeItem } from "./blob/BlobContainerTreeItem";
import { FileShareGroupTreeItem } from './fileShare/FileShareGroupTreeItem';
import { IStorageRoot } from './IStorageRoot';
import { QueueGroupTreeItem } from './queue/QueueGroupTreeItem';
import { TableGroupTreeItem } from './table/TableGroupTreeItem';

export type WebsiteHostingStatus = {
    capable: boolean;
    enabled: boolean;
    indexDocument?: string;
    errorDocument404Path?: string;
};

type StorageTypes = 'Storage' | 'StorageV2' | 'BlobStorage';

export class StorageAccountTreeItem extends AzureParentTreeItem<IStorageRoot> {
    public key: StorageAccountKeyWrapper;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
    };
    public childTypeLabel: string = 'resource type';
    public autoSelectInTreeItemPicker: boolean = true;

    private readonly _blobContainerGroupTreeItem: BlobContainerGroupTreeItem;
    private readonly _fileShareGroupTreeItem: FileShareGroupTreeItem;
    private readonly _queueGroupTreeItem: QueueGroupTreeItem;
    private readonly _tableGroupTreeItem: TableGroupTreeItem;
    private _root: IStorageRoot;

    private constructor(
        parent: AzureParentTreeItem,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly storageManagementClient?: StorageManagementClient,
        public readonly connectionString?: string) {
        super(parent);
        this._root = this.createRoot(parent.root);
        this._blobContainerGroupTreeItem = new BlobContainerGroupTreeItem(this);
        this._fileShareGroupTreeItem = new FileShareGroupTreeItem(this);
        this._queueGroupTreeItem = new QueueGroupTreeItem(this);
        this._tableGroupTreeItem = new TableGroupTreeItem(this);
    }

    public static async createStorageAccountTreeItem(parent: AzureParentTreeItem, storageAccount: StorageAccountWrapper, client?: StorageManagementClient, connectionString?: string): Promise<StorageAccountTreeItem> {
        const ti = new StorageAccountTreeItem(parent, storageAccount, client, connectionString);
        // make sure key is initialized
        await ti.refreshKey();
        return ti;
    }

    public get root(): IStorageRoot {
        return this._root;
    }

    public id: string = this.storageAccount.id;
    public label: string = this.storageAccount.name;
    public static contextValue: string = 'azureStorageAccount';
    public contextValue: string = `${StorageAccountTreeItem.contextValue}${this.connectionString ? attachedAccountSuffix : ''}`;

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<IStorageRoot>[]> {
        let groupTreeItems: AzureTreeItem<IStorageRoot>[] = [];

        if (this.connectionString) {
            // This is an attached account
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
        } else {
            let primaryEndpoints = this.storageAccount.primaryEndpoints;

            if (!!primaryEndpoints.blob) {
                groupTreeItems.push(this._blobContainerGroupTreeItem);
            }

            if (!!primaryEndpoints.file) {
                groupTreeItems.push(this._fileShareGroupTreeItem);
            }

            if (!!primaryEndpoints.queue) {
                groupTreeItems.push(this._queueGroupTreeItem);
            }

            if (!!primaryEndpoints.table) {
                groupTreeItems.push(this._tableGroupTreeItem);
            }
        }

        return groupTreeItems;
    }

    hasMoreChildrenImpl(): boolean {
        return false;
    }

    async refreshKey(): Promise<void> {
        let keys: StorageAccountKeyWrapper[] = await this.getKeys();
        let primaryKey = keys.find(key => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        if (primaryKey) {
            this.key = new StorageAccountKeyWrapper(primaryKey);
        } else if (!this.connectionString) {
            // A key is expected
            throw new Error("Could not find primary key");
        }
    }

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete account '${this.label}' and all its contents?`;
        //Use ext.ui to emulate user input by TestUserInput() method so that the tests can work
        const result = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            let storageManagementClient = createAzureClient(this.root, StorageManagementClient);
            let parsedId = this.parseAzureResourceId(this.storageAccount.id);
            let resourceGroupName = parsedId.resourceGroups;
            await storageManagementClient.storageAccounts.deleteMethod(resourceGroupName, this.storageAccount.name);
        } else {
            throw new UserCancelledError();
        }
    }

    private createRoot(subRoot: ISubscriptionContext): IStorageRoot {
        return Object.assign({}, subRoot, {
            storageAccount: this.storageAccount,
            createBlobServiceClient: () => {
                if (this.connectionString) {
                    return azureStorageBlob.BlobServiceClient.fromConnectionString(this.connectionString);
                } else {
                    const credential = new azureStorageBlob.StorageSharedKeyCredential(this.storageAccount.name, this.key.value);
                    return new azureStorageBlob.BlobServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'blob'), credential);
                }
            },
            createFileService: () => {
                if (this.connectionString) {
                    return new azureStorage.FileService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
                } else {
                    return azureStorage.createFileService(this.storageAccount.name, this.key.value, this.storageAccount.primaryEndpoints.file).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
                }
            },
            createShareServiceClient: () => {
                if (this.connectionString) {
                    return azureStorageShare.ShareServiceClient.fromConnectionString(this.connectionString);
                } else {
                    const credential = new azureStorageShare.StorageSharedKeyCredential(this.storageAccount.name, this.key.value);
                    return new azureStorageShare.ShareServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'file'), credential);
                }
            },
            createQueueService: () => {
                if (this.connectionString) {
                    return new azureStorage.QueueService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
                } else {
                    return azureStorage.createQueueService(this.storageAccount.name, this.key.value, this.storageAccount.primaryEndpoints.queue).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
                }
            },
            createTableService: () => {
                if (this.connectionString) {
                    return new azureStorage.TableService(this.connectionString).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
                } else {
                    // tslint:disable-next-line:no-any the typings for createTableService are incorrect
                    return azureStorage.createTableService(this.storageAccount.name, this.key.value, <any>this.storageAccount.primaryEndpoints.table).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
                }
            }
        });
    }

    async getConnectionString(): Promise<string> {
        return this.connectionString || `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${this.key.value};`;
    }

    async getKeys(): Promise<StorageAccountKeyWrapper[]> {
        if (this.storageManagementClient) {
            let parsedId = this.parseAzureResourceId(this.storageAccount.id);
            let resourceGroupName = parsedId.resourceGroups;
            let keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
            // tslint:disable-next-line:strict-boolean-expressions
            return (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
        }

        return [];
    }

    parseAzureResourceId(resourceId: string): { [key: string]: string } {
        const invalidIdErr = new Error('Invalid Account ID.');
        const result = {};

        if (!resourceId || resourceId.length < 2 || resourceId.charAt(0) !== '/') {
            throw invalidIdErr;
        }

        const parts = resourceId.substring(1).split('/');

        if (parts.length % 2 !== 0) {
            throw invalidIdErr;
        }

        for (let i = 0; i < parts.length; i += 2) {
            const key = parts[i];
            const value = parts[i + 1];

            if (key === '' || value === '') {
                throw invalidIdErr;
            }

            result[key] = value;
        }

        return result;
    }

    public async getWebsiteCapableContainer(context: IActionContext): Promise<BlobContainerTreeItem | undefined> {
        // Refresh the storage account first to make sure $web has been picked up if new
        await this.refresh();

        // Currently only the child with the name "$web" is supported for hosting websites
        let id = `${this.id}/${this._blobContainerGroupTreeItem.id || this._blobContainerGroupTreeItem.label}/${staticWebsiteContainerName}`;
        let containerTreeItem = <BlobContainerTreeItem>await this.treeDataProvider.findTreeItem(id, context);
        return containerTreeItem;
    }

    // This is the URL to use for browsing the website
    public getPrimaryWebEndpoint(): string | undefined {
        // Right now Azure only supports one web endpoint per storage account
        return this.storageAccount.primaryEndpoints.web;
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

    public async setWebsiteHostingProperties(properties: azureStorageBlob.BlobServiceProperties): Promise<void> {
        let serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        await serviceClient.setProperties(properties);
    }

    private async getAccountType(): Promise<StorageTypes> {
        let serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        let accountType: azureStorageBlob.AccountKind | undefined = (await serviceClient.getAccountInfo()).accountKind;

        if (!accountType) {
            throw new Error("Could not determine storage account type.");
        }

        return accountType;
    }

    public async configureStaticWebsite(promptForSettings: boolean = true): Promise<void> {
        const defaultIndexDocument: string = 'index.html';
        const defaultErrorDocument404Path: string = defaultIndexDocument;
        let indexDocument: string = defaultIndexDocument;
        let errorDocument404Path: string | undefined = defaultErrorDocument404Path;
        let oldStatus: WebsiteHostingStatus = await this.getActualWebsiteHostingStatus();
        await this.ensureHostingCapable(oldStatus);

        if (promptForSettings) {
            indexDocument = await ext.ui.showInputBox({
                prompt: "Enter the index document name",
                value: oldStatus.indexDocument ? oldStatus.indexDocument : defaultIndexDocument,
                validateInput: (value: string): string | undefined => this.validateIndexDocumentName(value)
            });

            errorDocument404Path = await ext.ui.showInputBox({
                prompt: "Enter the 404 error document path",
                value: oldStatus.errorDocument404Path ? oldStatus.errorDocument404Path : defaultErrorDocument404Path,
                validateInput: (value: string): string | undefined => this.validateErrorDocumentName(value)
                // tslint:disable-next-line: strict-boolean-expressions
            }) || undefined;
        }

        let newStatus: azureStorageBlob.BlobServiceProperties = {
            staticWebsite: {
                enabled: true,
                errorDocument404Path,
                indexDocument
            }
        };
        await this.setWebsiteHostingProperties(newStatus);
        let msg = oldStatus.enabled ?
            'Static website hosting configuration updated.' :
            `The storage account '${this.label}' has been enabled for static website hosting.`;
        // tslint:disable-next-line: strict-boolean-expressions
        msg += ` Index document: ${indexDocument}, 404 error document: ${errorDocument404Path || 'none'}`;
        window.showInformationMessage(msg);
        if (newStatus.staticWebsite && oldStatus.enabled !== newStatus.staticWebsite.enabled) {
            await ext.tree.refresh(this);
        }
    }

    public async disableStaticWebsite(): Promise<void> {
        let websiteHostingStatus = await this.getActualWebsiteHostingStatus();
        if (!websiteHostingStatus.enabled) {
            window.showInformationMessage(`Account '${this.label}' does not currently have static website hosting enabled.`);
            return;
        }
        let disableMessage: MessageItem = { title: "Disable" };
        let confirmDisable: MessageItem = await ext.ui.showWarningMessage(`Are you sure you want to disable static web hosting for the account '${this.label}'?`, { modal: true }, disableMessage, DialogResponses.cancel);
        if (confirmDisable === disableMessage) {
            let props = { staticWebsite: { enabled: false } };
            await this.setWebsiteHostingProperties(props);
            window.showInformationMessage(`Static website hosting has been disabled for account ${this.label}.`);
            await ext.tree.refresh(this);
        }
    }

    private validateIndexDocumentName(documentpath: string): undefined | string {
        const minLengthDocumentPath = 3;
        const maxLengthDocumentPath = 255;
        if (documentpath.includes('/')) {
            return "The index document path cannot contain a '/' character.";
        } else if (documentpath.length < minLengthDocumentPath || documentpath.length > maxLengthDocumentPath) {
            return `The index document path must be between ${minLengthDocumentPath} and ${maxLengthDocumentPath} characters in length.`;
        }

        return undefined;
    }

    private validateErrorDocumentName(documentpath: string): undefined | string {
        const minLengthDocumentPath = 3;
        const maxLengthDocumentPath = 255;
        if (documentpath) {
            if (documentpath.startsWith('/') || documentpath.endsWith('/')) {
                return "The error document path start or end with a '/' character.";
            } else if (documentpath.length < minLengthDocumentPath || documentpath.length > maxLengthDocumentPath) {
                return `The error document path must be between ${minLengthDocumentPath} and ${maxLengthDocumentPath} characters in length.`;
            }
        }
        return undefined;
    }

    public async browseStaticWebsite(): Promise<void> {
        const configure: MessageItem = {
            title: "Configure website hosting"
        };

        let hostingStatus = await this.getActualWebsiteHostingStatus();
        await this.ensureHostingCapable(hostingStatus);

        if (!hostingStatus.enabled) {
            let msg = "Static website hosting is not enabled for this storage account.";
            let result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', this);
            }
            throw new UserCancelledError(msg);
        }

        if (!hostingStatus.indexDocument) {
            let msg = "No index document has been set for this website.";
            let result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', this);
            }
            throw new UserCancelledError(msg);
        }

        let endpoint = this.getPrimaryWebEndpoint();
        if (endpoint) {
            await opn(endpoint);
        } else {
            throw new Error(`Could not retrieve the primary web endpoint for ${this.label}`);
        }
    }

    public async ensureHostingCapable(hostingStatus: WebsiteHostingStatus): Promise<void> {
        if (!hostingStatus.capable) {
            // Doesn't support static website hosting. Try to narrow it down.
            let accountType: StorageTypes | undefined;
            try {
                accountType = await this.getAccountType();
            } catch (error) {
                // Ignore errors
            }
            if (accountType !== 'StorageV2') {
                throw new Error("Only general purpose V2 storage accounts support static website hosting.");
            }

            throw new Error("This storage account does not support static website hosting.");
        }
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
