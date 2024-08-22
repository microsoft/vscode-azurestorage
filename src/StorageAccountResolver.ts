/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { BlobServiceProperties } from "@azure/storage-blob";

import { StorageAccount, StorageManagementClient } from "@azure/arm-storage";
import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { IActionContext, ISubscriptionContext, callWithTelemetryAndErrorHandling, nonNullProp } from "@microsoft/vscode-azext-utils";
import { AppResource, AppResourceResolver, ResolvedAppResourceBase } from "@microsoft/vscode-azext-utils/hostapi";
import { IStorageRoot } from "./tree/IStorageRoot";
import { StorageAccountTreeItem, WebsiteHostingStatus } from "./tree/StorageAccountTreeItem";
import { BlobContainerTreeItem } from "./tree/blob/BlobContainerTreeItem";
import { createStorageClient } from "./utils/azureClients";
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

    private storageAccountCacheLastUpdated = 0;
    private storageAccountCache: Map<string, StorageAccount> = new Map<string, StorageAccount>();
    private listStorageAccountsTask: Promise<void> | undefined;

    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedStorageAccount | undefined> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            context.telemetry.properties.isActivationEvent = 'true';
            const storageManagementClient: StorageManagementClient = await createStorageClient([context, subContext]);

            if (this.storageAccountCacheLastUpdated < Date.now() - 1000 * 3) {
                this.storageAccountCacheLastUpdated = Date.now();
                this.listStorageAccountsTask = new Promise((resolve, reject) => {
                    this.storageAccountCache.clear();
                    uiUtils.listAllIterator(storageManagementClient.storageAccounts.list()).then((accounts) => {
                        for (const sa of accounts) {
                            if (sa.provisioningState !== 'Succeeded') {
                                // if it's not provisioned, remove it from the cache
                                this.storageAccountCache.delete(nonNullProp(sa, 'id'));
                            } else {
                                this.storageAccountCache.set(nonNullProp(sa, 'id'), sa);
                            }
                        }
                        resolve();
                    }).catch((reason) => {
                        reject(reason);
                    });

                });
            }

            await this.listStorageAccountsTask;
            const sa = this.storageAccountCache.get(resource.id);
            if (!sa) {
                throw new Error(`Storage account not found: ${resource.id}`);
            }

            return await StorageAccountTreeItem.createStorageAccountTreeItem(subContext, new StorageAccountWrapper({ ...resource, ...sa }), storageManagementClient);
        });
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.storage/storageaccounts';
    }
}
