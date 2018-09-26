/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { commands, window } from 'vscode';
import { AzureTreeItem, DialogResponses, IActionContext, UserCancelledError } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { BlobContainerTreeItem } from "./blobContainers/blobContainerNode";
import { StorageAccountTreeItem } from "./storageAccounts/storageAccountNode";

/**
 * Given a treeItem argument for a command, if it is:
 *   1) undefined, then query the user for a storage account
 *   2) a storage account treeItem, then return it
 *   3) a blob container treeItem, then return the storage account treeItem
 *   4) anything else, then throw an internal error
 */
export async function selectStorageAccountTreeItemForCommand(
    treeItem: AzureTreeItem | undefined,
    actionContext: IActionContext,
    options: { mustBeWebsiteCapable: boolean, askToConfigureWebsite: boolean }
): Promise<StorageAccountTreeItem> {
    // treeItem should be one of:
    //   undefined
    //   a storage account treeItem
    //   a blob container treeItem

    if (!treeItem) {
        treeItem = <StorageAccountTreeItem>await ext.tree.showTreePicker(StorageAccountTreeItem.contextValue);
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
        let hostingStatus = await accountTreeItem.getWebsiteHostingStatus();
        await accountTreeItem.ensureHostingCapable(hostingStatus);

        if (options.askToConfigureWebsite && !hostingStatus.enabled) {
            let result = await window.showInformationMessage(
                `Website hosting is not enabled on storage account "${accountTreeItem.label}". Would you like to go to the portal to enable it?`,
                DialogResponses.yes,
                DialogResponses.no);
            let enableResponse = (result === DialogResponses.yes);
            actionContext.properties.enableResponse = String(enableResponse);
            actionContext.properties.cancelStep = 'StorageAccountWebSiteNotEnabled';
            if (enableResponse) {
                await commands.executeCommand("azureStorage.configureStaticWebsite", accountTreeItem);
            }
            // Either way can't continue
            throw new UserCancelledError();

        }
    }

    return accountTreeItem;
}
