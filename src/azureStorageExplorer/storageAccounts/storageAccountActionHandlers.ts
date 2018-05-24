/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { StorageAccountNode } from './storageAccountNode';
import * as copypaste from 'copy-paste';
import { IAzureNode, AzureActionHandler, IAzureParentNode, IActionContext, TelemetryProperties, parseError, AzureTreeDataProvider } from 'vscode-azureextensionui';
import * as ext from "../../constants";
import { showWorkspaceFoldersQuickPick } from "../blobContainers/quickPickUtils";

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
async function deployStaticWebsite(this: IActionContext, target?: vscode.Uri | IAzureParentNode<StorageAccountNode>): Promise<void> {
    // This command can be called from a folder or from a storage node

    let properties: TelemetryProperties & {
        contextValue?: string;
    } = this.properties;

    let sourcePath: string;
    //asdf let destContainerNode: IAzureParentNode<BlobContainerNode>;
    let destAccountNode: IAzureParentNode<StorageAccountNode>;
    //asdf let confirmDeployment: boolean = true;

    //asdf
    // const onNodeCreatedFromQuickPickDisposable: vscode.Disposable = tree.onNodeCreate((newNode: IAzureNode<WebAppTreeItem>) => {
    //     // event is fired from azure-extensionui if node was created during deployment
    //     newNodes.push(newNode);
    // });
    if (target instanceof vscode.Uri) {
        // Command called from file view on a folder
        sourcePath = target.fsPath;
        properties.contextValue = 'Folder';
    } else {
        sourcePath = await showWorkspaceFoldersQuickPick("Select the folder to deploy", this.properties, ext.configurationSettingsKeys.deployPath);
        destAccountNode = target;
        properties.contextValue = (destAccountNode && destAccountNode.treeItem.contextValue) || 'CommandPalette';
    }

    if (!destAccountNode) {
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

    return destAccountNode.treeItem.deployStaticWebsite(destAccountNode, this, sourcePath);
}
