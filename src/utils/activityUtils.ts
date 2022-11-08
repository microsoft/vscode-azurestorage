/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { getWorkspaceSetting } from "./settingsUtils";

export async function createActivityContext(): Promise<ExecuteActivityContext> {
    return {
        registerActivity: (activity) => ext.rgApi2.registerActivity(activity),
        suppressNotification: await getWorkspaceSetting('suppressActivityNotifications', undefined, 'azureResourceGroups'),
    };
}
