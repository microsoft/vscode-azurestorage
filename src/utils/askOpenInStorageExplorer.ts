/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { platform } from "os";
import { window } from "vscode";
import { IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { storageExplorerDownloadUrl } from "../constants";
import { ResourceType } from "../storageExplorerLauncher/ResourceType";
import { storageExplorerLauncher } from "../storageExplorerLauncher/storageExplorerLauncher";
import { localize } from "./localize";
import { openUrl } from "./openUrl";

export async function askOpenInStorageExplorer(context: IActionContext, errorMessage: string, resourceId: string, subscriptionId: string, resourceType: ResourceType, resourceName: string): Promise<void> {
    const openMessage: string = localize('openInSE', 'Open resource in Storage Explorer');
    const downloadMessage: string = localize('downloadSE', 'Download Storage Explorer');
    const message: string = platform() === 'linux' ? downloadMessage : openMessage;
    window.showErrorMessage(errorMessage, message).then(async result => {
        if (result === openMessage) {
            context.telemetry.properties.openInStorageExplorer = 'true';
            await storageExplorerLauncher.openResource(resourceId, subscriptionId, resourceType, resourceName);
        } else if (result === downloadMessage) {
            context.telemetry.properties.openStorageExplorerDownloadUrl = 'true';
            await openUrl(storageExplorerDownloadUrl);
        }
    });

    // Either way, throw canceled error
    throw new UserCancelledError(message);
}
