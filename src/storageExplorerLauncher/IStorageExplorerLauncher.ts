/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "vscode-azureextensionui";
import { ResourceType } from "./ResourceType";

export interface IStorageExplorerLauncher {
    openResource(context: IActionContext, accountId: string, subscriptionid: string, resourceType?: ResourceType, resourceName?: string): Promise<void>;
}
