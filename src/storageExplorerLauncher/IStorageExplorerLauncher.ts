/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IStorageExplorerLauncher {
    openResource(resourceId: string, subscriptionid: string, resourceType: string, resourceName: string);
}
