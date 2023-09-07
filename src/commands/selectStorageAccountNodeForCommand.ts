/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, IActionContext } from "@microsoft/vscode-azext-utils";
import * as assert from 'assert';
import { storageFilter } from "../constants";
import { ext } from "../extensionVariables";
import { AttachedStorageAccountTreeItem } from '../tree/AttachedStorageAccountTreeItem';
import { BlobContainerTreeItem } from "../tree/blob/BlobContainerTreeItem";
import { isResolvedStorageAccountTreeItem, ResolvedStorageAccountTreeItem } from "../tree/StorageAccountTreeItem";
import { localize } from '../utils/localize';

/**
 * Given a treeItem argument for a command, if it is:
 *   1) undefined, then query the user for a storage account
 *   2) a storage account treeItem, then return it
 *   3) a blob container treeItem, then return the storage account treeItem
 *   4) anything else, then throw an internal error
 */
export async function selectStorageAccountTreeItemForCommand(
    treeItem: AzExtTreeItem | undefined,
    context: ISelectStorageAccountContext,
    options: { mustBeWebsiteCapable: boolean, configureWebsite: boolean }
): Promise<ResolvedStorageAccountTreeItem> {
    // treeItem should be one of:
    //   undefined
    //   a storage account treeItem
    //   a blob container treeItem

    if (treeItem?.parent?.parent instanceof AttachedStorageAccountTreeItem) {
        // https://github.com/microsoft/vscode-azurestorage/issues/634
        throw new Error(localize('staticWebsiteCommandsNotSupportedForAttachedAccounts', 'Static website commands are not supported for attached accounts.'));
    }

    context.showEnableWebsiteHostingPrompt = true;

    if (!treeItem) {
        treeItem = await ext.rgApi.pickAppResource<ResolvedStorageAccountTreeItem & AzExtTreeItem>(context, {
            filter: storageFilter,
        });
    }

    const storageOrContainerTreeItem = <ResolvedStorageAccountTreeItem & AzExtTreeItem | BlobContainerTreeItem>treeItem;
    assert(
        isResolvedStorageAccountTreeItem(storageOrContainerTreeItem) || storageOrContainerTreeItem instanceof BlobContainerTreeItem,
        `Internal error: Incorrect treeItem type "${storageOrContainerTreeItem.contextValue}" passed to selectStorageAccountTreeItemForCommand()`);

    let accountTreeItem: ResolvedStorageAccountTreeItem & AzExtTreeItem;
    if (storageOrContainerTreeItem instanceof BlobContainerTreeItem) {
        // Currently the portal only allows configuring at the storage account level, so retrieve the storage account treeItem
        accountTreeItem = storageOrContainerTreeItem.getStorageAccountTreeItem(storageOrContainerTreeItem);
    } else {
        assert(isResolvedStorageAccountTreeItem(storageOrContainerTreeItem));
        accountTreeItem = <ResolvedStorageAccountTreeItem & AzExtTreeItem>treeItem;
    }

    if (options.mustBeWebsiteCapable) {
        const hostingStatus = await accountTreeItem.getActualWebsiteHostingStatus();
        await accountTreeItem.ensureHostingCapable(context, hostingStatus);

        if (options.configureWebsite && !hostingStatus.enabled) {
            context.telemetry.properties.cancelStep = 'StorageAccountWebSiteNotEnabled';

            if (context.showEnableWebsiteHostingPrompt) {
                context.telemetry.properties.enableResponse = 'false';
                const enableWebHostingPrompt = "Enable website hosting";
                // don't check result since cancel throws UserCancelledError and only other option is 'Enable'
                await context.ui.showWarningMessage(
                    `Website hosting is not enabled on storage account "${accountTreeItem.label}".`,
                    { modal: true },
                    { title: enableWebHostingPrompt });
                context.telemetry.properties.enableResponse = 'true';
            }

            await accountTreeItem.configureStaticWebsite(context);
        }
    }

    return accountTreeItem;
}

export interface ISelectStorageAccountContext extends IActionContext {
    showEnableWebsiteHostingPrompt?: boolean;
}
