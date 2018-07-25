/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { commands, window } from 'vscode';
import { DialogResponses, IActionContext, IAzureNode, IAzureParentNode, IAzureTreeItem, UserCancelledError } from "vscode-azureextensionui";
import { ext } from "../extensionVariables";
import { BlobContainerNode } from "./blobContainers/blobContainerNode";
import { StorageAccountNode } from "./storageAccounts/storageAccountNode";

/**
 * Given a node argument for a command, if it is:
 *   1) undefined, then query the user for a storage account
 *   2) a storage account node, then return it
 *   3) a blob container node, then return the storage account node
 *   4) anything else, then throw an internal error
 */
export async function selectStorageAccountNodeForCommand(
    node: IAzureNode<IAzureTreeItem> | undefined,
    actionContext: IActionContext,
    options: { mustBeWebsiteCapable: boolean, askToConfigureWebsite: boolean }
): Promise<IAzureParentNode<StorageAccountNode>> {
    // Node should be one of:
    //   undefined
    //   a storage account node
    //   a blob container node

    let storageOrContainerNode = <IAzureNode<StorageAccountNode> | IAzureNode<BlobContainerNode>>node;
    if (!storageOrContainerNode) {
        storageOrContainerNode = <IAzureNode<StorageAccountNode>>await ext.tree.showNodePicker(StorageAccountNode.contextValue);
    }

    let accountNode: IAzureParentNode<StorageAccountNode>;
    if (storageOrContainerNode.treeItem instanceof BlobContainerNode) {
        // Currently the portal only allows configuring at the storage account level, so retrieve the storage account node
        accountNode = storageOrContainerNode.treeItem.getStorageAccountNode(node);
    } else if (storageOrContainerNode.treeItem instanceof StorageAccountNode) {
        accountNode = <IAzureParentNode<StorageAccountNode>>storageOrContainerNode;
    } else {
        throw new Error(`Internal error: Unexpected node type: ${node.treeItem.contextValue}`);
    }

    if (options.mustBeWebsiteCapable) {
        let hostingStatus = await accountNode.treeItem.getWebsiteHostingStatus();
        await accountNode.treeItem.ensureHostingEnabled(hostingStatus);

        if (options.askToConfigureWebsite && !hostingStatus.enabled) {
            let result = await window.showInformationMessage(
                `Website hosting is not enabled on storage account "${accountNode.treeItem.label}". Would you like to go to the portal to enable it?`,
                DialogResponses.yes,
                DialogResponses.no);
            let enableResponse = (result === DialogResponses.yes);
            actionContext.properties.enableResponse = String(enableResponse);
            actionContext.properties.cancelStep = 'StorageAccountWebSiteNotEnabled';
            if (enableResponse) {
                await commands.executeCommand("azureStorage.configureStaticWebsite", accountNode);
            }
            // Either way can't continue
            throw new UserCancelledError();

        }
    }

    return accountNode;
}
