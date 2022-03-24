import { StorageAccount, StorageManagementClient } from "@azure/arm-storage";
import { callWithTelemetryAndErrorHandling, IActionContext, ISubscriptionContext, nonNullProp } from "@microsoft/vscode-azext-utils";
import { AppResource, AppResourceResolver, ResolvedAppResourceBase } from "./api";
import { IStorageRoot } from "./tree/IStorageRoot";
import { StorageAccountTreeItem } from "./tree/StorageAccountTreeItem";
import { createStorageClient } from "./utils/azureClients";
import { getResourceGroupFromId } from "./utils/azureUtils";
import { StorageAccountWrapper } from "./utils/storageWrappers";


export interface ResolvedStorageAccount extends ResolvedAppResourceBase {
    root: IStorageRoot;
}

export class StorageAccountResolver implements AppResourceResolver {

    // possibly pass down the full tree item, but for now try to get away with just the AppResource
    public async resolveResource(subContext: ISubscriptionContext, resource: AppResource): Promise<ResolvedStorageAccount | null> {
        return await callWithTelemetryAndErrorHandling('resolveResource', async (context: IActionContext) => {
            try {
                const storageManagementClient: StorageManagementClient = await createStorageClient([context, subContext]);
                const sa: StorageAccount = await storageManagementClient.storageAccounts.getProperties(getResourceGroupFromId(nonNullProp(resource, 'id')), nonNullProp(resource, 'name'));
                return StorageAccountTreeItem.createStorageAccountTreeItem(subContext, new StorageAccountWrapper({ ...resource, ...sa }), storageManagementClient);
            } catch (e) {
                console.error({ ...context, ...subContext });
                throw e;
            }
        }) ?? null;
    }

    public matchesResource(resource: AppResource): boolean {
        return resource.type.toLowerCase() === 'microsoft.storage/storageaccounts';
    }
}
