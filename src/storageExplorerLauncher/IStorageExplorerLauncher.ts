/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceType } from "./ResourceType";

export interface IStorageExplorerLauncher {
    openResource(accountId: string, subscriptionid: string, resourceType?: ResourceType, resourceName?: string): Promise<void>;
}
