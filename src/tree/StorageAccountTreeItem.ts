/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import * as azureStorageBlob from '@azure/storage-blob';
import { AccountSASSignatureValues, generateAccountSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import * as vscode from 'vscode';
import { commands, MessageItem, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, AzureWizard, DialogResponses, IActionContext, ISubscriptionContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath, staticWebsiteContainerName } from '../constants';
import { ext } from "../extensionVariables";
import { createStorageClient } from '../utils/azureClients';
import { localize } from '../utils/localize';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from '../utils/storageWrappers';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { BlobContainerTreeItem } from "./blob/BlobContainerTreeItem";
import { IStaticWebsiteConfigWizardContext } from './createWizard/IStaticWebsiteConfigWizardContext';
import { StaticWebsiteConfigureStep } from './createWizard/StaticWebsiteConfigureStep';
import { StaticWebsiteErrorDocument404Step } from './createWizard/StaticWebsiteErrorDocument404Step';
import { StaticWebsiteIndexDocumentStep } from './createWizard/StaticWebsiteIndexDocumentStep';
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

export class StorageAccountTreeItem extends AzureParentTreeItem<IStorageRoot> {
    public key: StorageAccountKeyWrapper;
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
        public readonly storageManagementClient: StorageManagementClient) {
        super(parent);
        this.id = this.storageAccount.id;
        this._root = this.createRoot(parent.root);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureStorageAccount.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureStorageAccount.svg')
        };
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

    public label: string = this.storageAccount.name;
    public static contextValue: string = 'azureStorageAccount';
    public contextValue: string = StorageAccountTreeItem.contextValue;

    // eslint-disable-next-line @typescript-eslint/require-await
    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem<IStorageRoot>[]> {
        const primaryEndpoints = this.storageAccount.primaryEndpoints;
        const groupTreeItems: AzureTreeItem<IStorageRoot>[] = [];

        if (primaryEndpoints.blob) {
            groupTreeItems.push(this._blobContainerGroupTreeItem);
        }

        if (primaryEndpoints.file) {
            groupTreeItems.push(this._fileShareGroupTreeItem);
        }

        if (primaryEndpoints.queue) {
            groupTreeItems.push(this._queueGroupTreeItem);
        }

        if (primaryEndpoints.table) {
            groupTreeItems.push(this._tableGroupTreeItem);
        }

        return groupTreeItems;
    }

    hasMoreChildrenImpl(): boolean {
        return false;
    }

    async refreshKey(): Promise<void> {
        const keys: StorageAccountKeyWrapper[] = await this.getKeys();
        const primaryKey = keys.find(key => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        if (primaryKey) {
            this.key = new StorageAccountKeyWrapper(primaryKey);
        } else {
            throw new Error("Could not find primary key");
        }
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const message: string = `Are you sure you want to delete account "${this.label}" and all its contents?`;
        // Use ext.ui to emulate user input by TestUserInput() method so that the tests can work
        const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const deletingStorageAccount: string = localize('deletingStorageAccount', 'Deleting storage account "{0}"...', this.label);
            const storageManagementClient = await createStorageClient(this.root);
            const parsedId = this.parseAzureResourceId(this.storageAccount.id);
            const resourceGroupName = parsedId.resourceGroups;

            ext.outputChannel.appendLog(deletingStorageAccount);
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: deletingStorageAccount }, async () => {
                await storageManagementClient.storageAccounts.deleteMethod(resourceGroupName, this.storageAccount.name);
            });

            const deleteSuccessful: string = localize('successfullyDeletedStorageAccount', 'Successfully deleted storage account "{0}".', this.label);
            ext.outputChannel.appendLog(deleteSuccessful);
            void window.showInformationMessage(deleteSuccessful);
        } else {
            throw new UserCancelledError();
        }
    }

    private createRoot(subRoot: ISubscriptionContext): IStorageRoot {
        return Object.assign({}, subRoot, {
            storageAccountName: this.storageAccount.name,
            storageAccountId: this.storageAccount.id,
            isEmulated: false,
            primaryEndpoints: this.storageAccount.primaryEndpoints,
            generateSasToken: (accountSASSignatureValues: AccountSASSignatureValues) => {
                return generateAccountSASQueryParameters(
                    accountSASSignatureValues,
                    new StorageSharedKeyCredential(this.storageAccount.name, this.key.value)
                ).toString();
            },
            createBlobServiceClient: () => {
                const credential = new azureStorageBlob.StorageSharedKeyCredential(this.storageAccount.name, this.key.value);
                return new azureStorageBlob.BlobServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'blob'), credential);
            },
            createShareServiceClient: () => {
                const credential = new azureStorageShare.StorageSharedKeyCredential(this.storageAccount.name, this.key.value);
                return new azureStorageShare.ShareServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'file'), credential);
            },
            createQueueService: () => {
                return azureStorage.createQueueService(this.storageAccount.name, this.key.value, this.storageAccount.primaryEndpoints.queue).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            },
            createTableService: () => {
                // The typings for createTableService are incorrect
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return azureStorage.createTableService(this.storageAccount.name, this.key.value, <any>this.storageAccount.primaryEndpoints.table).withFilter(new azureStorage.ExponentialRetryPolicyFilter());
            }
        });
    }

    getConnectionString(): string {
        return `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${this.key.value};EndpointSuffix=${nonNullProp(this.root.environment, 'storageEndpointSuffix')}`;
    }

    async getKeys(): Promise<StorageAccountKeyWrapper[]> {
        const parsedId = this.parseAzureResourceId(this.storageAccount.id);
        const resourceGroupName = parsedId.resourceGroups;
        const keyResult = await this.storageManagementClient.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
        return (keyResult.keys || <StorageManagementModels.StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
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
        await this.refresh(context);

        // Currently only the child with the name "$web" is supported for hosting websites
        const id = `${this.id}/${this._blobContainerGroupTreeItem.id || this._blobContainerGroupTreeItem.label}/${staticWebsiteContainerName}`;
        const containerTreeItem = <BlobContainerTreeItem>await this.treeDataProvider.findTreeItem(id, context);
        return containerTreeItem;
    }

    // This is the URL to use for browsing the website
    public getPrimaryWebEndpoint(): string | undefined {
        // Right now Azure only supports one web endpoint per storage account
        return this.storageAccount.primaryEndpoints.web;
    }

    public async getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus> {
        // Does NOT update treeItem's _webHostingEnabled.
        const serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        const properties: azureStorageBlob.ServiceGetPropertiesResponse = await serviceClient.getProperties();
        const staticWebsite: azureStorageBlob.StaticWebsite | undefined = properties.staticWebsite;

        return {
            capable: !!staticWebsite,
            enabled: !!staticWebsite && staticWebsite.enabled,
            indexDocument: staticWebsite && staticWebsite.indexDocument,
            errorDocument404Path: staticWebsite && staticWebsite.errorDocument404Path
        };
    }

    public async setWebsiteHostingProperties(properties: azureStorageBlob.BlobServiceProperties): Promise<void> {
        const serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        await serviceClient.setProperties(properties);
    }

    private async getAccountType(): Promise<azureStorageBlob.AccountKind> {
        const serviceClient: azureStorageBlob.BlobServiceClient = this.root.createBlobServiceClient();
        const accountType: azureStorageBlob.AccountKind | undefined = (await serviceClient.getAccountInfo()).accountKind;

        if (!accountType) {
            throw new Error("Could not determine storage account type.");
        }

        return accountType;
    }

    public async configureStaticWebsite(context: IActionContext): Promise<void> {
        const oldStatus: WebsiteHostingStatus = await this.getActualWebsiteHostingStatus();
        const wizardContext: IStaticWebsiteConfigWizardContext = Object.assign(<IStaticWebsiteConfigWizardContext>context, this);
        wizardContext.enableStaticWebsite = true;
        const wizard: AzureWizard<IStaticWebsiteConfigWizardContext> = new AzureWizard(wizardContext, {
            promptSteps: [new StaticWebsiteIndexDocumentStep(oldStatus.indexDocument), new StaticWebsiteErrorDocument404Step(oldStatus.errorDocument404Path)],
            executeSteps: [new StaticWebsiteConfigureStep(this, oldStatus.enabled)],
            title: localize('configureStaticWebsite', 'Configure static website'),
        });
        await wizard.prompt();
        await wizard.execute();
    }

    public async disableStaticWebsite(context: IActionContext): Promise<void> {
        const websiteHostingStatus = await this.getActualWebsiteHostingStatus();
        await this.ensureHostingCapable(context, websiteHostingStatus);

        if (!websiteHostingStatus.enabled) {
            void window.showInformationMessage(`Account '${this.label}' does not currently have static website hosting enabled.`);
            return;
        }
        const disableMessage: MessageItem = { title: "Disable" };
        const confirmDisable: MessageItem = await context.ui.showWarningMessage(`Are you sure you want to disable static web hosting for the account '${this.label}'?`, { modal: true }, disableMessage, DialogResponses.cancel);
        if (confirmDisable === disableMessage) {
            const props = { staticWebsite: { enabled: false } };
            await this.setWebsiteHostingProperties(props);
            void window.showInformationMessage(`Static website hosting has been disabled for account ${this.label}.`);
            await ext.tree.refresh(context, this);
        }
    }

    public async browseStaticWebsite(context: IActionContext): Promise<void> {
        const configure: MessageItem = {
            title: "Configure website hosting"
        };

        const hostingStatus = await this.getActualWebsiteHostingStatus();
        await this.ensureHostingCapable(context, hostingStatus);

        if (!hostingStatus.enabled) {
            const msg = "Static website hosting is not enabled for this storage account.";
            const result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', this);
            }
            throw new UserCancelledError(msg);
        }

        if (!hostingStatus.indexDocument) {
            const msg = "No index document has been set for this website.";
            const result = await window.showErrorMessage(msg, configure);
            if (result === configure) {
                await commands.executeCommand('azureStorage.configureStaticWebsite', this);
            }
            throw new UserCancelledError(msg);
        }

        const endpoint = this.getPrimaryWebEndpoint();
        if (endpoint) {
            await openUrl(endpoint);
        } else {
            throw new Error(`Could not retrieve the primary web endpoint for ${this.label}`);
        }
    }

    public async ensureHostingCapable(context: IActionContext, hostingStatus: WebsiteHostingStatus): Promise<void> {
        if (!hostingStatus.capable) {
            // Doesn't support static website hosting. Try to narrow it down.
            let accountType: azureStorageBlob.AccountKind | undefined;
            try {
                accountType = await this.getAccountType();
            } catch (error) {
                // Ignore errors
            }
            if (accountType !== 'StorageV2') {
                context.errorHandling.suppressReportIssue = true;
                throw new Error(localize('onlyGeneralPurposeV2', 'Only general purpose V2 storage accounts support static website hosting.'));
            }

            throw new Error(localize('doesntSupportHosting', 'This storage account does not support static website hosting.'));
        }
    }
}
