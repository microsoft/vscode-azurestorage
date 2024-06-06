/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import type { BlobServiceProperties } from "@azure/storage-blob";

import { StorageAccount, StorageManagementClient } from "@azure/arm-storage";
import { uiUtils } from "@microsoft/vscode-azext-azureutils";
import { IActionContext, ISubscriptionContext, callWithTelemetryAndErrorHandling, nonNullProp, nonNullValue } from "@microsoft/vscode-azext-utils";
import { AppResource, AppResourceResolver, ResolvedAppResourceBase } from "@microsoft/vscode-azext-utils/hostapi";
import { ext } from "./extensionVariables";
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

    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedStorageAccount | null> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            context.telemetry.properties.isActivationEvent = 'true';
            const storageManagementClient: StorageManagementClient = await createStorageClient([context, subContext]);

            if (this.storageAccountCacheLastUpdated < Date.now() - 1000 * 5) {
                this.storageAccountCache.clear();

                ext.outputChannel.appendLog('Listing all storage accounts...');
                const storageAccounts = await uiUtils.listAllIterator(storageManagementClient.storageAccounts.list());
                ext.outputChannel.appendLog('Done.');
                storageAccounts.forEach(storageAccount => this.storageAccountCache.set(nonNullProp(storageAccount, 'id'), storageAccount));

                this.storageAccountCacheLastUpdated = Date.now();
            } else {
                ext.outputChannel.appendLog('Using cached storage accounts.');
            }
            const sa: StorageAccount = nonNullValue(this.storageAccountCache.get(resource.id), 'storageAccount');
            return StorageAccountTreeItem.createStorageAccountTreeItem(subContext, new StorageAccountWrapper({ ...resource, ...sa }), storageManagementClient);
        }) ?? null;
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.storage/storageaccounts';
    }
}
