import { StorageManagementClient } from "@azure/arm-storage";
import { StorageManagementClient as StackStorageManagementClient } from '@azure/arm-storage-profile-2019-03-01-hybrid';
import { createAzureClient, ISubscriptionContext } from "vscode-azureextensionui";
import { getEnvironment, ifStack } from "./environmentUtils";

export async function createStorageClientResult(clientInfo: ISubscriptionContext, subscriptionTreeFlag: boolean): Promise<IStorageClientResult> {
    let isAzureStack: boolean = ifStack();
    let storageManagementClient: StorageManagementClient | StackStorageManagementClient;
    if (isAzureStack) {
        if (subscriptionTreeFlag) {
            await getEnvironment(clientInfo);
        }
        storageManagementClient = createAzureClient(clientInfo, StackStorageManagementClient);
    } else {
        storageManagementClient = createAzureClient(clientInfo, StorageManagementClient);
    }
    let storageClientResult: IStorageClientResult = {
        client: storageManagementClient,
        isAzureStack: isAzureStack
    };
    return storageClientResult;
}

export interface IStorageClientResult {
    client: StorageManagementClient | StackStorageManagementClient;
    isAzureStack: boolean;
}
