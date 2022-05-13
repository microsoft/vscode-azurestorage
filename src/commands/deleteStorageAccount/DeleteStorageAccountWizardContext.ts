/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext, IActionContext, ISubscriptionContext } from "@microsoft/vscode-azext-utils";
import { StorageAccountWrapper } from "../../utils/storageWrappers";

export interface DeleteStorageAccountWizardContext extends IActionContext, ExecuteActivityContext {
    resourceGroupName?: string;
    storageAccount?: StorageAccountWrapper;
    subscription: ISubscriptionContext;
}
