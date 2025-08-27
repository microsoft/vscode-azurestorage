/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { BlobServiceProperties } from "@azure/storage-blob";

import { ResourceGraphClient } from "@azure/arm-resourcegraph";
import { getResourceGroupFromId } from "@microsoft/vscode-azext-azureutils";
import { IActionContext, ISubscriptionContext, callWithTelemetryAndErrorHandling } from "@microsoft/vscode-azext-utils";
import { AppResource, AppResourceResolver, ResolvedAppResourceBase } from "@microsoft/vscode-azext-utils/hostapi";
import { IStorageRoot } from "./tree/IStorageRoot";
import { StorageAccountTreeItem, StorageQueryResult, WebsiteHostingStatus } from "./tree/StorageAccountTreeItem";
import { BlobContainerTreeItem } from "./tree/blob/BlobContainerTreeItem";
import { createResourceGraphClient, createStorageClient } from "./utils/azureClients";
import { StorageAccountWrapper } from "./utils/storageWrappers";

export interface ResolvedStorageAccount extends ResolvedAppResourceBase {
    label: string;
    root: IStorageRoot;
    storageAccount: StorageAccountWrapper;
    getWebsiteCapableContainer(context: IActionContext): Promise<BlobContainerTreeItem | undefined>;
    getActualWebsiteHostingStatus(): Promise<WebsiteHostingStatus>;
    setWebsiteHostingProperties(properties: BlobServiceProperties): Promise<void>;
    ensureHostingCapable(context: IActionContext, hostingStatus: WebsiteHostingStatus): Promise<void>;
    configureStaticWebsite(context: IActionContext): Promise<void>;
    disableStaticWebsite(context: IActionContext): Promise<void>;
    browseStaticWebsite(context: IActionContext): Promise<void>;
    kind: 'microsoft.storage/storageaccounts';
}

export class StorageAccountResolver implements AppResourceResolver {
    private loaded: boolean = false;
    private storageAccountCacheLastUpdated = 0;
    private storageAccountCache: Map<string, StorageQueryResult> = new Map<string, StorageQueryResult>();
    private listStorageAccountsTask: Promise<void> | undefined;

    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedStorageAccount | undefined> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            context.telemetry.properties.isActivationEvent = 'true';
            if (this.storageAccountCacheLastUpdated < Date.now() - 1000 * 3) {
                this.loaded = false;
                this.storageAccountCacheLastUpdated = Date.now();
                this.storageAccountCache.clear();
                const graphClient = await createResourceGraphClient({ ...context, ...subContext });
                async function fetchAllAccounts(graphClient: ResourceGraphClient, subContext: ISubscriptionContext, resolver: StorageAccountResolver) {
                    const subscriptions = [subContext.subscriptionId];
                    const query = "resources|where type =~ \"microsoft.storage/storageaccounts\" or type =~ \"microsoft.classicstorage/storageaccounts\"";


                    async function fetchAccounts(skipToken?: string): Promise<void> {
                        const queryRequest = {
                            subscriptions,
                            query,
                            options: {
                                skipToken
                            }
                        };

                        const response = await graphClient.resources(queryRequest);
                        const record = response.data as Record<string, StorageQueryResult>;
                        Object.values(record).forEach(data => {
                            resolver.storageAccountCache.set(data.id.toLowerCase(), data);
                        });

                        const nextSkipToken = response?.skipToken;
                        if (nextSkipToken) {
                            await fetchAccounts(nextSkipToken);
                        } else {
                            resolver.loaded = true;
                            return;
                        }
                    }
                    return await fetchAccounts();
                }

                this.listStorageAccountsTask = fetchAllAccounts(graphClient, subContext, this);
            }

            while (!this.loaded) {
                await this.listStorageAccountsTask;
            }

            const dataModel = this.storageAccountCache.get(resource.id.toLowerCase());
            let storageAccount: StorageAccountWrapper | undefined;
            if (!dataModel) {
                // Fetch the storage account from the storage plane if it doesn't exist in the ARM query
                const storageClient = await createStorageClient({ ...context, ...subContext });
                storageAccount = new StorageAccountWrapper((await storageClient.storageAccounts.getProperties(getResourceGroupFromId(resource.id), resource.name)));
            }

            return new StorageAccountTreeItem(subContext, storageAccount, dataModel)
        });
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.storage/storageaccounts';
    }
}
