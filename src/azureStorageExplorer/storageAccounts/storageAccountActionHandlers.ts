/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as copypaste from 'copy-paste';
import * as vscode from "vscode";
import { IActionContext, IAzureNode, IAzureParentNode, registerCommand, TelemetryProperties } from 'vscode-azureextensionui';
import * as ext from "../../constants";
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerNode } from "../blobContainers/blobContainerNode";
import { showWorkspaceFoldersQuickPick } from "../blobContainers/quickPickUtils";
import { selectStorageAccountNodeForCommand } from '../selectStorageAccountNodeForCommand';
import { StorageAccountNode } from './storageAccountNode';

export function registerStorageAccountActionHandlers(): void {
    registerCommand("azureStorage.openStorageAccount", openStorageAccountInStorageExplorer);
    registerCommand("azureStorage.copyPrimaryKey", copyPrimaryKey);
    registerCommand("azureStorage.copyConnectionString", copyConnectionString);
    registerCommand("azureStorage.deployStaticWebsite", deployStaticWebsite);
}

async function openStorageAccountInStorageExplorer(node: IAzureNode<StorageAccountNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;

    await storageExplorerLauncher.openResource(accountId, node.subscriptionId);
}

async function copyPrimaryKey(node: IAzureNode<StorageAccountNode>): Promise<void> {
    let primaryKey = await node.treeItem.getPrimaryKey();
    copypaste.copy(primaryKey.value);
}

async function copyConnectionString(node: IAzureNode<StorageAccountNode>): Promise<void> {
    let connectionString = await node.treeItem.getConnectionString();
    copypaste.copy(connectionString);
}

async function deployStaticWebsite(this: IActionContext, target?: vscode.Uri | IAzureParentNode<StorageAccountNode> | IAzureParentNode<BlobContainerNode>): Promise<void> {
    let properties: TelemetryProperties & {
        contextValue?: string;
        enableResponse?: string;
    } = this.properties;

    let sourcePath: string | undefined;
    let destNode: IAzureParentNode<StorageAccountNode> | IAzureParentNode<BlobContainerNode> | undefined;

    // Disambiguate context this was executed from
    if (target instanceof vscode.Uri) {
        // Command called from file view on a folder
        sourcePath = target.fsPath;
        properties.contextValue = 'Folder';
    } else {
        // Command called from command palette or from storage account/container node
        destNode = <IAzureParentNode<StorageAccountNode> | IAzureParentNode<BlobContainerNode>>target;
        // tslint:disable-next-line:strict-boolean-expressions
        properties.contextValue = (destNode && destNode.treeItem.contextValue) || 'CommandPalette';
    }

    // Ask first for destination account if needed since it might require configuration and don't want to have user
    // select source location only to have to possibly cancel.

    let destAccountNode: IAzureParentNode<StorageAccountNode> = await selectStorageAccountNodeForCommand(
        destNode,
        this, // actionContext
        {
            mustBeWebsiteCapable: true,
            askToConfigureWebsite: true
        });

    //  Ask for source folder if needed
    if (!sourcePath) {
        sourcePath = await showWorkspaceFoldersQuickPick("Select the folder to deploy", this.properties, ext.configurationSettingsKeys.deployPath);
    }

    // Get the $web container
    let destContainerNode = await destAccountNode.treeItem.getWebsiteCapableContainer(destAccountNode);
    if (!destContainerNode) {
        throw new Error(`Could not find $web blob container for storage account "${destAccountNode.treeItem.label}"`);
    }

    return destContainerNode.treeItem.deployStaticWebsite(destContainerNode, this, sourcePath);
}
