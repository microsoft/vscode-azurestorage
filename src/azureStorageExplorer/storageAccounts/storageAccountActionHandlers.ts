/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { StorageAccountNode } from './storageAccountNode';
import * as copypaste from 'copy-paste';
import { IAzureNode, AzureActionHandler, IAzureParentNode, IActionContext, TelemetryProperties, parseError, AzureTreeDataProvider, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import * as ext from "../../constants";
import { showWorkspaceFoldersQuickPick } from "../blobContainers/quickPickUtils";
import { BlobContainerNode } from "../blobContainers/blobContainerNode";

let _tree: AzureTreeDataProvider;

export function registerStorageAccountActionHandlers(actionHandler: AzureActionHandler, tree: AzureTreeDataProvider): void {
    _tree = tree;

    actionHandler.registerCommand("azureStorage.openStorageAccount", openStorageAccountInStorageExplorer);
    actionHandler.registerCommand("azureStorage.copyPrimaryKey", copyPrimaryKey);
    actionHandler.registerCommand("azureStorage.copyConnectionString", copyConnectionString);
    actionHandler.registerCommand("azureStorage.deployStaticWebsite", deployStaticWebsite);
}

function openStorageAccountInStorageExplorer(node: IAzureNode<StorageAccountNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;

    return storageExplorerLauncher.openResource(accountId, node.subscriptionId);
}

async function copyPrimaryKey(node: IAzureNode<StorageAccountNode>): Promise<void> {
    let primaryKey = await node.treeItem.getPrimaryKey();
    copypaste.copy(primaryKey.value);
}

async function copyConnectionString(node: IAzureNode<StorageAccountNode>): Promise<void> {
    let connectionString = await node.treeItem.getConnectionString();
    copypaste.copy(connectionString);
}

// tslint:disable-next-line:max-func-body-length
async function deployStaticWebsite(this: IActionContext, target?: vscode.Uri | IAzureParentNode<StorageAccountNode> | IAzureParentNode<BlobContainerNode>): Promise<void> {
    // asdf refactor

    let properties: TelemetryProperties & {
        contextValue?: string;
        enableResponse?: string;
    } = this.properties;

    let sourcePath: string;
    let destNode: IAzureParentNode<StorageAccountNode> | IAzureParentNode<BlobContainerNode>;
    let destAccountNode: IAzureParentNode<StorageAccountNode>;
    let destContainerNode: IAzureParentNode<BlobContainerNode>;

    // Disambiguate context this was executed from
    if (target instanceof vscode.Uri) {
        // Command called from file view on a folder
        sourcePath = target.fsPath;
        properties.contextValue = 'Folder';
    } else {
        // Command called command palette or from storage account/container node
        destNode = target;
        properties.contextValue = (destNode && destNode.treeItem.contextValue) || 'CommandPalette';

        if (destNode) {
            let contextValue = destNode.treeItem.contextValue;
            if (contextValue === StorageAccountNode.contextValue) {
                // Called from storage account node
                destAccountNode = <IAzureParentNode<StorageAccountNode>>destNode;
            } else if (contextValue === BlobContainerNode.contextValue) {
                // Called from blob container node
                destContainerNode = <IAzureParentNode<BlobContainerNode>>destNode;
            }
        }
    }

    // Ask first for destination account/container if needed since it might require configuration and don't want to have user
    // select source location only to have to possibly cancel.
    if (!destNode) {
        try {
            // asdf: infer return type
            destAccountNode = <IAzureParentNode<StorageAccountNode>>await _tree.showNodePicker(StorageAccountNode.contextValue);
        } catch (err2) {
            if (parseError(err2).isUserCancelledError) {
                this.properties.cancelStep = `showNodePicker:${StorageAccountNode.contextValue}`;
            }
            throw err2;
        }
    }

    if (!destContainerNode) {
        // Determine destination container node
        console.assert(!!destAccountNode, "Should have a storage account node");
        let enabledContainers = await destAccountNode.treeItem.getWebsiteEnabledContainers(destAccountNode);
        if (enabledContainers.length === 0) { //testpoint
            let result = await vscode.window.showInformationMessage(
                "Website hosting is not enabled on this storage account. Would you like to go to the portal to enable it?",
                DialogResponses.yes,
                DialogResponses.no
            );
            let enableResponse = (result === DialogResponses.yes);
            properties.enableResponse = String(enableResponse);
            properties.cancelStep = 'StorageAccountWebSiteNotEnabled';
            if (enableResponse) {
                await vscode.commands.executeCommand("azureStorage.configureStaticWebsite", destNode);
            }

            // Either way can't continue
            throw new UserCancelledError();
        } else {
            // Currently only a single enabled container is supported by Azure
            destContainerNode = enabledContainers[0];
        }
    }
    console.assert(!!destContainerNode, "Should have a destination container node by now");

    //  Ask for source if needed
    if (!sourcePath) {
        sourcePath = await showWorkspaceFoldersQuickPick("Select the folder to deploy", this.properties, ext.configurationSettingsKeys.deployPath);
    }

    return destContainerNode.treeItem.deployStaticWebsite(destContainerNode, this, sourcePath);
}
