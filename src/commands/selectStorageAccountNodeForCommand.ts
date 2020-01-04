/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { AzureTreeItem, IActionContext } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { StorageAccountTreeItem } from "../tree/StorageAccountTreeItem";

/**
 * Given a treeItem argument for a command, if it is:
 *   1) undefined, then query the user for a storage account
 *   2) a storage account treeItem, then return it
 *   3) a blob container treeItem, then return the storage account treeItem
 *   4) anything else, then throw an internal error
 */
export async function selectStorageAccountTreeItemForCommand(
    treeItem: AzureTreeItem | undefined,
    context: IActionContext,
    options: { mustBeWebsiteCapable: boolean, configureWebsite: boolean }
): Promise<StorageAccountTreeItem> {
    // treeItem should be one of:
    //   undefined
    //   a storage account treeItem
    //   a blob container treeItem

    context.telemetry.properties.showEnableWebsiteHostingPrompt = 'true';

    if (!treeItem) {
        treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue, context);
    }

    let storageOrContainerTreeItem = <StorageAccountTreeItem | BlobContainerTreeItem>treeItem;
    assert(
        storageOrContainerTreeItem instanceof StorageAccountTreeItem || storageOrContainerTreeItem instanceof BlobContainerTreeItem,
        `Internal error: Incorrect treeItem type "${storageOrContainerTreeItem.contextValue}" passed to selectStorageAccountTreeItemForCommand()`);

    let accountTreeItem: StorageAccountTreeItem;
    if (storageOrContainerTreeItem instanceof BlobContainerTreeItem) {
        // Currently the portal only allows configuring at the storage account level, so retrieve the storage account treeItem
        accountTreeItem = storageOrContainerTreeItem.getStorageAccountTreeItem(storageOrContainerTreeItem);
    } else {
        assert(storageOrContainerTreeItem instanceof StorageAccountTreeItem);
        accountTreeItem = <StorageAccountTreeItem>treeItem;
    }

    if (options.mustBeWebsiteCapable) {
        let hostingStatus = await accountTreeItem.getActualWebsiteHostingStatus();
        await accountTreeItem.ensureHostingCapable(hostingStatus);

        if (options.configureWebsite && !hostingStatus.enabled) {
            context.telemetry.properties.cancelStep = 'StorageAccountWebSiteNotEnabled';

            if (context.telemetry.properties.showEnableWebsiteHostingPrompt === 'true') {
                context.telemetry.properties.enableResponse = 'false';
                let enableWebHostingPrompt = "Enable website hosting";
                // don't check result since cancel throws UserCancelledError and only other option is 'Enable'
                await ext.ui.showWarningMessage(
                    `Website hosting is not enabled on storage account "${accountTreeItem.label}".`,
                    { modal: true },
                    { title: enableWebHostingPrompt });
                context.telemetry.properties.enableResponse = 'true';
            }

            await accountTreeItem.configureStaticWebsite();
        }
    }

    return accountTreeItem;
}
