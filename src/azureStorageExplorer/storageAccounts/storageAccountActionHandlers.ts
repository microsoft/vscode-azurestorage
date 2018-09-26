/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as copypaste from 'copy-paste';
import * as vscode from "vscode";
import { IActionContext, registerCommand, TelemetryProperties } from 'vscode-azureextensionui';
import * as ext from "../../constants";
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerTreeItem } from "../blobContainers/blobContainerNode";
import { showWorkspaceFoldersQuickPick } from "../blobContainers/quickPickUtils";
import { selectStorageAccountTreeItemForCommand } from '../selectStorageAccountNodeForCommand';
import { StorageAccountTreeItem } from './storageAccountNode';

export function registerStorageAccountActionHandlers(): void {
    registerCommand("azureStorage.openStorageAccount", openStorageAccountInStorageExplorer);
    registerCommand("azureStorage.copyPrimaryKey", copyPrimaryKey);
    registerCommand("azureStorage.copyConnectionString", copyConnectionString);
    registerCommand("azureStorage.deployStaticWebsite", deployStaticWebsite);
}

async function openStorageAccountInStorageExplorer(treeItem: StorageAccountTreeItem): Promise<void> {
    let accountId = treeItem.storageAccount.id;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId);
}

async function copyPrimaryKey(treeItem: StorageAccountTreeItem): Promise<void> {
    let primaryKey = await treeItem.getPrimaryKey();
    copypaste.copy(primaryKey.value);
}

async function copyConnectionString(treeItem: StorageAccountTreeItem): Promise<void> {
    let connectionString = await treeItem.getConnectionString();
    copypaste.copy(connectionString);
}

async function deployStaticWebsite(this: IActionContext, target?: vscode.Uri | StorageAccountTreeItem | BlobContainerTreeItem): Promise<void> {
    let properties: TelemetryProperties & {
        contextValue?: string;
        enableResponse?: string;
    } = this.properties;

    let sourcePath: string | undefined;
    let destTreeItem: StorageAccountTreeItem | BlobContainerTreeItem | undefined;

    // Disambiguate context this was executed from
    if (target instanceof vscode.Uri) {
        // Command called from file view on a folder
        sourcePath = target.fsPath;
        properties.contextValue = 'Folder';
    } else {
        // Command called from command palette or from storage account/container treeItem
        destTreeItem = <StorageAccountTreeItem | BlobContainerTreeItem>target;
        // tslint:disable-next-line:strict-boolean-expressions
        properties.contextValue = (destTreeItem && destTreeItem.contextValue) || 'CommandPalette';
    }

    // Ask first for destination account if needed since it might require configuration and don't want to have user
    // select source location only to have to possibly cancel.

    let destAccountTreeItem: StorageAccountTreeItem = await selectStorageAccountTreeItemForCommand(
        destTreeItem,
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
    let destContainerTreeItem = await destAccountTreeItem.getWebsiteCapableContainer();
    if (!destContainerTreeItem) {
        throw new Error(`Could not find $web blob container for storage account "${destAccountTreeItem.label}"`);
    }

    return destContainerTreeItem.deployStaticWebsite(this, sourcePath);
}
