/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient } from '@azure/arm-storage';
import { createAzureClient, ISubscriptionContext } from 'vscode-azureextensionui';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createStorageClient<T extends ISubscriptionContext>(context: T): Promise<StorageManagementClient> {
    if (context.isStack) {
        return <StorageManagementClient><unknown>createAzureClient(context, (await import('@azure/arm-storage-profile-2019-03-01-hybrid')).StorageManagementClient);
    } else {
        return createAzureClient(context, (await import('@azure/arm-storage')).StorageManagementClient);
    }
}
