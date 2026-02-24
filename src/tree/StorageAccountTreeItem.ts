/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccountKind, AccountSASSignatureValues, BlobServiceProperties, ServiceGetPropertiesResponse, StaticWebsite } from '@azure/storage-blob';

import { AzureNamedKeyCredential, TableServiceClient } from '@azure/data-tables';
import { BlobServiceClient, StorageSharedKeyCredential as StorageSharedKeyCredentialBlob, generateAccountSASQueryParameters } from '@azure/storage-blob';
import { ShareServiceClient, StorageSharedKeyCredential as StorageSharedKeyCredentialFileShare } from '@azure/storage-file-share';
import { QueueServiceClient, StorageSharedKeyCredential as StorageSharedKeyCredentialQueue } from '@azure/storage-queue';

import { StorageAccount, StorageAccountKey } from '@azure/arm-storage';
import { getResourceGroupFromId } from '@microsoft/vscode-azext-azureutils';
import { AzExtParentTreeItem, AzExtTreeItem, AzureWizard, DeleteConfirmationStep, DialogResponses, IActionContext, ISubscriptionContext, UserCancelledError, callWithTelemetryAndErrorHandling } from '@microsoft/vscode-azext-utils';
import { ResolvedAppResourceTreeItem } from '@microsoft/vscode-azext-utils/hostapi';
import { ViewPropertiesModel } from '@microsoft/vscode-azureresources-api';
import { MessageItem, commands, window } from 'vscode';
import { ResolvedStorageAccount } from '../StorageAccountResolver';
import { DeleteStorageAccountStep } from '../commands/deleteStorageAccount/DeleteStorageAccountStep';
import { DeleteStorageAccountWizardContext } from '../commands/deleteStorageAccount/DeleteStorageAccountWizardContext';
import { staticWebsiteContainerName } from '../constants';
import { ext } from "../extensionVariables";
import { createActivityContext } from '../utils/activityUtils';
import { createStorageClient } from '../utils/azureClients';
import { localize } from '../utils/localize';
import { nonNullProp } from '../utils/nonNull';
import { openUrl } from '../utils/openUrl';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from '../utils/storageWrappers';
import { IStorageRoot } from './IStorageRoot';
import { IStorageTreeItem } from './IStorageTreeItem';
import { BlobContainerGroupTreeItem } from './blob/BlobContainerGroupTreeItem';
import { BlobContainerTreeItem } from "./blob/BlobContainerTreeItem";
import { IStaticWebsiteConfigWizardContext } from './createWizard/IStaticWebsiteConfigWizardContext';
import { StaticWebsiteConfigureStep } from './createWizard/StaticWebsiteConfigureStep';
import { StaticWebsiteErrorDocument404Step } from './createWizard/StaticWebsiteErrorDocument404Step';
import { StaticWebsiteIndexDocumentStep } from './createWizard/StaticWebsiteIndexDocumentStep';
import { FileShareGroupTreeItem } from './fileShare/FileShareGroupTreeItem';
import { QueueGroupTreeItem } from './queue/QueueGroupTreeItem';
import { TableGroupTreeItem } from './table/TableGroupTreeItem';

export type WebsiteHostingStatus = {
    capable: boolean;
    enabled: boolean;
    indexDocument?: string;
    errorDocument404Path?: string;
};

export type StorageQueryResult = {
    id: string,
    location: string,
    name: string,
    resourceGroup: string,
    subscriptionId: string,
    type: string,
    properties: {
        allowSharedKeyAccess: boolean
    }
}

export type ResolvedStorageAccountTreeItem = ResolvedAppResourceTreeItem<ResolvedStorageAccount>;

export function isResolvedStorageAccountTreeItem(t: unknown): t is ResolvedStorageAccountTreeItem {
    return (t as ResolvedStorageAccountTreeItem)?.kind?.toLowerCase() === StorageAccountTreeItem.kind;
}

export class StorageAccountTreeItem implements ResolvedStorageAccount, IStorageTreeItem {
    public static kind: 'microsoft.storage/storageaccounts' = 'microsoft.storage/storageaccounts';
    public readonly kind = StorageAccountTreeItem.kind;
    public _key: StorageAccountKeyWrapper;
    public childTypeLabel: string = 'resource type';
    public autoSelectInTreeItemPicker: boolean = true;

    private _subscription: ISubscriptionContext;
    public dataModel: StorageQueryResult;
    private _blobContainerGroupTreeItem: BlobContainerGroupTreeItem;
    private _fileShareGroupTreeItem: FileShareGroupTreeItem;
    private _queueGroupTreeItem: QueueGroupTreeItem;
    private _tableGroupTreeItem: TableGroupTreeItem;
    private _root: IStorageRoot | undefined = undefined;
    private _storageAccount: StorageAccountWrapper | undefined = undefined;

    constructor(subscription: ISubscriptionContext,
        storageAccount: StorageAccount | undefined,
        dataModel?: StorageQueryResult
    ) {
        this._subscription = subscription;
        if (storageAccount) {
            this._storageAccount = new StorageAccountWrapper(storageAccount);
            this.dataModel = this.createDataModelFromStorageAccount(storageAccount);
        }

        if (dataModel) {
            this.dataModel = dataModel;
        }
    }

    public get allowSharedKeyAccess(): boolean {
        return !!this.dataModel?.properties.allowSharedKeyAccess;
    }

    public createDataModelFromStorageAccount(storageAccount: StorageAccount): StorageQueryResult {
        const storageAccountWrapper = new StorageAccountWrapper(storageAccount);
        return {
            id: storageAccountWrapper.id,
            location: storageAccountWrapper.location,
            name: storageAccountWrapper.name,
            resourceGroup: getResourceGroupFromId(storageAccountWrapper.id),
            subscriptionId: this._subscription.subscriptionId,
            type: storageAccountWrapper.type,
            properties: {
                allowSharedKeyAccess: !!storageAccount.allowSharedKeyAccess
            }
        };
    }

    public async refreshImpl(context: IActionContext): Promise<void> {
        this._storageAccount = undefined;
        this._root = undefined;
        return await this.initStorageAccount(context);
    }

    public get storageAccount(): StorageAccountWrapper {
        if (!this._storageAccount) {
            void callWithTelemetryAndErrorHandling('storageAccount.initAccountFailed', async (context: IActionContext) => {
                // try to lazy load the site if it hasn't been initialized yet
                void this.initStorageAccount(context);
            });
            // If the storage account is not initialized, we should throw an error
            throw new Error(localize('saNotSet', 'Storage account is not initialized. Please try again in a moment.'));
        }

        return this._storageAccount;
    }

    public async initStorageAccount(context: IActionContext): Promise<void> {
        if (!this._storageAccount || !this._root) {
            const client = await createStorageClient([context, this._subscription]);
            const storageAccount = await client.storageAccounts.getProperties(this.dataModel.resourceGroup, this.dataModel.name);
            this._storageAccount = new StorageAccountWrapper(storageAccount);
            this.dataModel = this.createDataModelFromStorageAccount(storageAccount);
            if (this.allowSharedKeyAccess) {
                await this.refreshKey(context);
            }
            this._root = this.createRoot();
        }

    }

    public get root(): IStorageRoot {
        if (!this._root) {
            this._root = this.createRoot();
        }

        return this._root;
    }

    public get label(): string {
        return this.dataModel.name;
    }

    public static contextValue: string = 'azureStorageAccount';
    public contextValuesToAdd: string[] = [StorageAccountTreeItem.contextValue];
    public get viewProperties(): ViewPropertiesModel {
        return {
            getData: async () => await this.getData(),
            label: this.label
        }
    }

    public async getData(): Promise<StorageAccountWrapper> {
        if (!this._storageAccount) {
            await callWithTelemetryAndErrorHandling('getData.initSite', async (context: IActionContext) => {
                await this.initStorageAccount(context);
            });
        }
        return this.storageAccount;
    }

    async loadMoreChildrenImpl(_clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        await this.initStorageAccount(context);
        this._blobContainerGroupTreeItem = new BlobContainerGroupTreeItem(this as unknown as (AzExtParentTreeItem & ResolvedAppResourceTreeItem<ResolvedStorageAccount>));
        this._fileShareGroupTreeItem = new FileShareGroupTreeItem(this as unknown as (AzExtParentTreeItem & ResolvedAppResourceTreeItem<ResolvedStorageAccount>));
        this._queueGroupTreeItem = new QueueGroupTreeItem(this as unknown as (AzExtParentTreeItem & ResolvedAppResourceTreeItem<ResolvedStorageAccount>));
        this._tableGroupTreeItem = new TableGroupTreeItem(this as unknown as (AzExtParentTreeItem & ResolvedAppResourceTreeItem<ResolvedStorageAccount>));

        const primaryEndpoints = this.storageAccount.primaryEndpoints;
        const groupTreeItems: AzExtTreeItem[] = [];

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

    async getKey(): Promise<StorageAccountKeyWrapper> {
        if (!this.allowSharedKeyAccess) {
            throw new Error(localize('storageAccountTreeItem.noSharedKeyAccess', 'No shared key access for storage account "{0}". Allow it to enable this command.', this.label));
        }

        await callWithTelemetryAndErrorHandling('storageAccountTreeItem.getKey', async (context: IActionContext) => {
            if (!this._key) {
                await this.refreshKey(context);
            }
        });

        return this._key;
    }

    async refreshKey(context: IActionContext): Promise<void> {
        try {
            const keys: StorageAccountKeyWrapper[] = await this.getKeys(context);
            const primaryKey = keys.find(key => {
                return key.keyName === "key1" || key.keyName === "primaryKey";
            });

            if (primaryKey) {
                this._key = new StorageAccountKeyWrapper(primaryKey);
            }
        } catch (err) {
            // no access to key, ignore error for now
        }
    }

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const deletingStorageAccount: string = localize('deleteStorageAccount', 'Delete storage account "{0}"', this.label);
        const wizardContext: DeleteStorageAccountWizardContext = Object.assign(context, {
            storageAccount: this.storageAccount,
            subscription: this._subscription,
            ...(await createActivityContext()),
            activityTitle: deletingStorageAccount
        });

        const message: string = `Are you sure you want to delete account "${this.label}" and all its contents?`;
        const wizard = new AzureWizard(wizardContext, {
            promptSteps: [new DeleteConfirmationStep(message)],
            executeSteps: [new DeleteStorageAccountStep()]
        });

        await wizard.prompt();
        await wizard.execute();
    }

    private createRoot(): IStorageRoot {
        return {
            storageAccountName: this.dataModel.name,
            storageAccountId: this.dataModel.id,
            tenantId: this._subscription.tenantId,
            isEmulated: false,
            allowSharedKeyAccess: this.allowSharedKeyAccess,
            primaryEndpoints: this.storageAccount.primaryEndpoints,
            getAccessToken: async (): Promise<string> => {
                const credentials = await this._subscription.createCredentialsForScopes(['https://storage.azure.com/.default']);
                const token = await credentials.getToken() as unknown as { token: string };
                return token.token;
            },
            generateSasToken: (accountSASSignatureValues: AccountSASSignatureValues) => {
                if (!this.allowSharedKeyAccess) {
                    throw new Error(localize('storageAccountTreeItem.noSharedKeyAccess', 'No shared key access for storage account "{0}". Allow it to enable this command.', this.label));
                }

                return generateAccountSASQueryParameters(
                    accountSASSignatureValues,
                    new StorageSharedKeyCredentialBlob(this.storageAccount.name, this._key.value)
                ).toString();
            },
            getStorageManagementClient: async (context: IActionContext) => {
                return await createStorageClient([context, this._subscription]);
            },
            createBlobServiceClient: async () => {
                let client: BlobServiceClient | undefined = undefined;
                if (this.allowSharedKeyAccess) {
                    try {
                        const credential = new StorageSharedKeyCredentialBlob(this.storageAccount.name, ((await this.getKey()).value));
                        client = new BlobServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'blob'), credential);
                        await client.getProperties(); // Trigger a request to validate the key
                    } catch (error) {
                        // ignore and try scoped token
                    }
                }

                if (!client) {
                    const token = await this._subscription.createCredentialsForScopes(['https://storage.azure.com/.default']);
                    client = new BlobServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'blob'), token);
                    await client.getProperties(); // Trigger a request to validate the token
                }

                return client;
            },
            createShareServiceClient: async () => {
                let client: ShareServiceClient | undefined = undefined;
                if (this.allowSharedKeyAccess) {
                    try {
                        const credential = new StorageSharedKeyCredentialFileShare(this.storageAccount.name, ((await this.getKey()).value));
                        client = new ShareServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'file'), credential);
                        await client.getProperties(); // Trigger a request to validate the key
                    } catch (error) {
                        // ignore and try scoped token
                    }
                }
                if (!client) {
                    const token = await this._subscription.createCredentialsForScopes(['https://storage.azure.com/.default']);
                    client = new ShareServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'file'), token, { fileRequestIntent: 'backup' });
                    await client.getProperties(); // Trigger a request to validate the token
                }

                return client;
            },
            createQueueServiceClient: async () => {
                let client: QueueServiceClient | undefined = undefined;
                if (this.allowSharedKeyAccess) {
                    try {
                        const credential = new StorageSharedKeyCredentialQueue(this.storageAccount.name, ((await this.getKey()).value));
                        client = new QueueServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'queue'), credential);
                        await client.getProperties(); // Trigger a request to validate the key
                    } catch (error) {
                        // ignore and try scoped token
                    }
                }
                if (!client) {
                    const token = await this._subscription.createCredentialsForScopes(['https://storage.azure.com/.default']);
                    client = new QueueServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'queue'), token);
                    await client.getProperties(); // Trigger a request to validate the token
                }

                return client;
            },
            createTableServiceClient: async () => {
                let client: TableServiceClient | undefined = undefined;
                if (this.allowSharedKeyAccess) {
                    try {
                        const credential = new AzureNamedKeyCredential(this.storageAccount.name, ((await this.getKey()).value));
                        client = new TableServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'table'), credential);
                        await client.getProperties(); // Trigger a request to validate the key
                    } catch (error) {
                        // ignore and try scoped token
                    }
                }
                if (!client) {
                    const token = await this._subscription.createCredentialsForScopes(['https://storage.azure.com/.default']);
                    client = new TableServiceClient(nonNullProp(this.storageAccount.primaryEndpoints, 'table'), token);
                    await client.getProperties(); // Trigger a request to validate the token
                }

                return client;
            }
        };
    }

    async getConnectionString(): Promise<string> {
        const key = await this.getKey();
        return `DefaultEndpointsProtocol=https;AccountName=${this.storageAccount.name};AccountKey=${key.value};EndpointSuffix=${nonNullProp(this._subscription.environment, 'storageEndpointSuffix')}`;
    }

    async getKeys(context: IActionContext): Promise<StorageAccountKeyWrapper[]> {
        const parsedId = StorageAccountTreeItem.parseAzureResourceId(this.storageAccount.id);
        const resourceGroupName = parsedId.resourceGroups;
        const client = await createStorageClient([context, this._subscription]);
        const keyResult = await client.storageAccounts.listKeys(resourceGroupName, this.storageAccount.name);
        return (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
    }

    public static parseAzureResourceId(resourceId: string): { [key: string]: string } {
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
        await (this as unknown as (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem)).getCachedChildren(context);

        // Currently only the child with the name "$web" is supported for hosting websites
        // Ensure that the children are loaded
        await this._blobContainerGroupTreeItem.getCachedChildren(context);
        const id = `${this._blobContainerGroupTreeItem.fullId || this._blobContainerGroupTreeItem.label}/${staticWebsiteContainerName}`;
        const containerTreeItem = <BlobContainerTreeItem>await ext.rgApi.appResourceTree.findTreeItem(id, context);
        return containerTreeItem;
    }

    // This is the URL to use for browsing the website
    public getPrimaryWebEndpoint(): string | undefined {
        // Right now Azure only supports one web endpoint per storage account
        return this.storageAccount.primaryEndpoints.web;
    }

    public async getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus> {
        // Does NOT update treeItem's _webHostingEnabled.
        const serviceClient: BlobServiceClient = await this.root.createBlobServiceClient();
        const properties: ServiceGetPropertiesResponse = await serviceClient.getProperties();
        const staticWebsite: StaticWebsite | undefined = properties.staticWebsite;

        return {
            capable: !!staticWebsite,
            enabled: !!staticWebsite && staticWebsite.enabled,
            indexDocument: staticWebsite && staticWebsite.indexDocument,
            errorDocument404Path: staticWebsite && staticWebsite.errorDocument404Path
        };
    }

    public async setWebsiteHostingProperties(properties: BlobServiceProperties): Promise<void> {
        const serviceClient: BlobServiceClient = await this.root.createBlobServiceClient();
        await serviceClient.setProperties(properties);
    }

    private async getAccountType(): Promise<AccountKind> {
        const serviceClient: BlobServiceClient = await this.root.createBlobServiceClient();
        const accountType: AccountKind | undefined = (await serviceClient.getAccountInfo()).accountKind;

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
            await ext.rgApi.appResourceTree.refresh(context, this as unknown as AzExtTreeItem);
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
            let accountType: AccountKind | undefined;
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
