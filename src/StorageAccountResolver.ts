/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { BlobServiceProperties } from "@azure/storage-blob";

import { StorageManagementClient } from "@azure/arm-storage";
import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { IActionContext, ISubscriptionContext, callWithTelemetryAndErrorHandling, nonNullProp, nonNullValue } from "@microsoft/vscode-azext-utils";
import { AppResource, AppResourceResolver, ResolvedAppResourceBase } from "@microsoft/vscode-azext-utils/hostapi";
import { IStorageRoot } from "./tree/IStorageRoot";
import { StorageAccountTreeItem, WebsiteHostingStatus } from "./tree/StorageAccountTreeItem";
import { BlobContainerTreeItem } from "./tree/blob/BlobContainerTreeItem";
import { createStorageClient } from "./utils/azureClients";
import { localize } from "./utils/localize";
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
    private storageAccountCache: Map<string, StorageAccountTreeItem> = new Map<string, StorageAccountTreeItem>();

    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedStorageAccount | undefined> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            context.telemetry.properties.isActivationEvent = 'true';
            const storageManagementClient: StorageManagementClient = await createStorageClient([context, subContext]);

            if (this.storageAccountCacheLastUpdated < Date.now() - 1000 * 5) {
                this.storageAccountCache.clear();
                const storageAccounts = await uiUtils.listAllIterator(storageManagementClient.storageAccounts.list());

                const promises = storageAccounts.map(async sa => {
                    const ti = await StorageAccountTreeItem.createStorageAccountTreeItem(subContext, new StorageAccountWrapper({ ...resource, ...sa }), storageManagementClient);
                    this.storageAccountCache.set(nonNullProp(sa, 'id'), ti);
                });
                await Promise.all(promises);

                this.storageAccountCacheLastUpdated = Date.now();
            }

            return nonNullValue(this.storageAccountCache.get(resource.id), localize('storageAccountNotFound', 'Storage account not found.'));
        });
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.storage/storageaccounts';
    }
}
