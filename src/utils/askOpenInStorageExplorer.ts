/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, UserCancelledError } from "@microsoft/vscode-azext-utils";
import { platform } from "os";
import { window } from "vscode";
import { ResourceType } from "../storageExplorerLauncher/ResourceType";
import { storageExplorerLauncher } from "../storageExplorerLauncher/storageExplorerLauncher";
import { localize } from "./localize";

export function askOpenInStorageExplorer(context: IActionContext, errorMessage: string, resourceId: string, subscriptionId: string, resourceType: ResourceType, resourceName: string): void {
    const message: string = localize("openInSE", "Open resource in Storage Explorer");
    const items: string[] = platform() === 'linux' ? [] : [message];
    void window.showErrorMessage(errorMessage, ...items).then(async result => {
        if (result === message) {
            context.telemetry.properties.openInStorageExplorer = 'true';
            await storageExplorerLauncher.openResource(resourceId, subscriptionId, resourceType, resourceName);
        }
    });

    // Either way, throw canceled error
    throw new UserCancelledError(message);
}
