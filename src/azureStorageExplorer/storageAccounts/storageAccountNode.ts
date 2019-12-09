/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import { StorageManagementClient } from 'azure-arm-storage';
import * as azureStorage from "azure-storage";
// tslint:disable-next-line:no-require-imports
import opn = require('opn');
import * as path from 'path';
import { commands, MessageItem, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, createAzureClient, DialogResponses, IActionContext, ISubscriptionContext, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from '../../components/storageWrappers';
import { getResourcesPath, staticWebsiteContainerName } from '../../constants';
import { ext } from "../../extensionVariables";
import { BlobContainerGroupTreeItem } from '../blobContainers/BlobContainerGroupTreeItem';
import { BlobContainerTreeItem } from "../blobContainers/BlobContainerTreeItem";
import { DirectoryTreeItem } from '../fileShares/directoryNode';
import { FileTreeItem } from '../fileShares/fileNode';
import { FileShareGroupTreeItem } from '../fileShares/fileShareGroupNode';
import { FileShareTreeItem } from '../fileShares/fileShareNode';
import { IStorageRoot } from '../IStorageRoot';
import { QueueGroupTreeItem } from '../queues/queueGroupNode';
import { QueueTreeItem } from '../queues/queueNode';
import { TableGroupTreeItem } from '../tables/tableGroupNode';
import { TableTreeItem } from '../tables/tableNode';

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

    private readonly _blobContainerGroupTreeItem: BlobContainerGroupTreeItem;
    private readonly _fileShareGroupTreeItem: FileShareGroupTreeItem;
    private readonly _queueGroupTreeItem: QueueGroupTreeItem;
    private readonly _tableGroupTreeItem: TableGroupTreeItem;
    private _root: IStorageRoot;

    private constructor(
        parent: AzureParentTreeItem,
        public readonly storageAccount: StorageAccountWrapper,
        public readonly storageManagementClient: StorageManagementClient) {
        super(parent);
        this._root = this.createRoot(parent.root);
        this._blobContainerGroupTreeItem = new BlobContainerGroupTreeItem(this);
        this._fileShareGroupTreeItem = new FileShareGroupTreeItem(this);
        this._queueGroupTreeItem = new QueueGroupTreeItem(this);
        this._tableGroupTreeItem = new TableGroupTreeItem(this);
    }

    public static async createStorageAccountTreeItem(parent: AzureParentTreeItem, storageAccount: StorageAccountWrapper, client: StorageManagementClient): Promise<StorageAccountTreeItem> {
        const ti = new StorageAccountTreeItem(parent, storageAccount, client);
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
    public contextValue: string = StorageAccountTreeItem.contextValue;

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<IStorageRoot>[]> {
        let primaryEndpoints = this.storageAccount.primaryEndpoints;
        let groupTreeItems: AzureTreeItem<IStorageRoot>[] = [];

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

        return groupTreeItems;
    }

    public pickTreeItemImpl(expectedContextValues: (string | RegExp)[]): AzureTreeItem<IStorageRoot> | undefined {
        for (const expectedContextValue of expectedContextValues) {
            switch (expectedContextValue) {
                case BlobContainerGroupTreeItem.contextValue:
                case BlobContainerTreeItem.contextValue:
                    return this._blobContainerGroupTreeItem;
                case FileShareGroupTreeItem.contextValue:
                case FileShareTreeItem.contextValue:
                case DirectoryTreeItem.contextValue:
                case FileTreeItem.contextValue:
                    return this._fileShareGroupTreeItem;
                case QueueGroupTreeItem.contextValue:
                case QueueTreeItem.contextValue:
                    return this._queueGroupTreeItem;
                case TableGroupTreeItem.contextValue:
                case TableTreeItem.contextValue:
                    return this._tableGroupTreeItem;
                default:
            }
        }

        return undefined;
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
        } else {
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
                const credential = new azureStorageBlob.StorageSharedKeyCredential(this.storageAccount.name, this.key.value);
                return new azureStorageBlob.BlobServiceClient(this.storageAccount.primaryEndpoints.blob || `https://${this.storageAccount.name}.blob.core.windows.net`, credential);
            },
            createFileService: () => {
                return azureStorage.createFileService(this.storageAccount.name, this.key.value, this.storageAccount.primaryEndpoints.file).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            },
            createQueueService: () => {
                return azureStorage.createQueueService(this.storageAccount.name, this.key.value, this.storageAccount.primaryEndpoints.queue).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            },
            createTableService: () => {
                // tslint:disable-next-line:no-any the typings for createTableService are incorrect
                return azureStorage.createTableService(this.storageAccount.name, this.key.value, <any>this.storageAccount.primaryEndpoints.table).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            }
        });
    }

    async getConnectionString(): Promise<string> {
        return `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${this.key.value};`;
    }

    async getKeys(): Promise<StorageAccountKeyWrapper[]> {
        let parsedId = this.parseAzureResourceId(this.storageAccount.id);
        let resourceGroupName = parsedId.resourceGroups;
        let keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
        // tslint:disable-next-line:strict-boolean-expressions
        return (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
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

    public async configureStaticWebsite(): Promise<void> {
        const defaultIndexDocumentName = 'index.html';
        let oldStatus = await this.getActualWebsiteHostingStatus();
        await this.ensureHostingCapable(oldStatus);
        let indexDocument = await ext.ui.showInputBox({
            prompt: "Enter the index document name",
            value: oldStatus.indexDocument ? oldStatus.indexDocument : defaultIndexDocumentName,
            validateInput: (value: string): string | undefined => this.validateIndexDocumentName(value)
        });

        let errorDocument404Path: string | undefined = await ext.ui.showInputBox({
            prompt: "Enter the 404 error document path",
            value: oldStatus.errorDocument404Path ? oldStatus.errorDocument404Path : "",
            placeHolder: 'e.g. error/documents/error.html',
            validateInput: (value: string): string | undefined => this.validateErrorDocumentName(value)
            // tslint:disable-next-line: strict-boolean-expressions
        }) || undefined;
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
}
