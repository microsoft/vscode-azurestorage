/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { openUrl } from "@microsoft/vscode-azext-utils";
import { IStorageExplorerLauncher } from "./IStorageExplorerLauncher";
import { ResourceType } from "./ResourceType";

export class WebStorageExplorerLauncher implements IStorageExplorerLauncher {
    public async openResource(accountId: string, subscriptionid: string, resourceType?: ResourceType, resourceName?: string): Promise<void> {
        let url = "storageexplorer://v=1"
            + "&accountid="
            + encodeURIComponent(accountId)
            + "&subscriptionid="
            + encodeURIComponent(subscriptionid)
            + "&source="
            + encodeURIComponent("VSCODE-AzureStorage");

        if (resourceType) {
            url = `${url}&resourcetype=${resourceType}`;
        }

        if (resourceName) {
            url = `${url}&resourcename=${resourceName}`;
        }

        await this.launchStorageExplorer(url);
    }

    private async launchStorageExplorer(url: string): Promise<void> {
        await openUrl(url);
    }
}

