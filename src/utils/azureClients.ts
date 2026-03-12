/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceGraphClient } from '@azure/arm-resourcegraph';
import type { StorageManagementClient } from '@azure/arm-storage';
import { AzExtClientContext, AzExtSubscriptionClientType, createAzureSubscriptionClient, createStorageClient as createStorageClientImpl, parseClientContext } from '@microsoft/vscode-azext-azureutils';

// Lazy-load @azure packages to improve startup performance.
// NOTE: The client is the only import that matters, the rest of the types disappear when compiled to JavaScript

export async function createStorageClient(context: AzExtClientContext): Promise<StorageManagementClient> {
    if (parseClientContext(context).isCustomCloud) {
        // set API version for Azure Stack
        process.env.AZCOPY_DEFAULT_SERVICE_API_VERSION = "2019-02-02";
    }

    return createStorageClientImpl(context);
}

export async function createResourceGraphClient(context: AzExtClientContext): Promise<ResourceGraphClient> {
    return createAzureSubscriptionClient(context, (await import('@azure/arm-resourcegraph')).ResourceGraphClient as unknown as AzExtSubscriptionClientType<ResourceGraphClient>);
}
