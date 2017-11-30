/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from '../../azureServiceExplorer/actions/baseActionHandler';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { StorageAccountNode } from './storageAccountNode';
import * as copypaste from 'copy-paste';

export class StorageAccountActionHandler extends BaseActionHandler {
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.openStorageAccount", (node) => { this.openStorageAccountInStorageExplorer(node) });
        this.initCommand(context, "azureStorage.copyPrimaryKey", (node) => { this.copyPrimaryKey(node) });
        this.initCommand(context, "azureStorage.copyConnectionString", (node) => { this.copyPrimaryKey(node) });
    }

    openStorageAccountInStorageExplorer(node: StorageAccountNode) {
        var resourceId = node.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        
        StorageExplorerLauncher.openResource(resourceId, subscriptionid);
    }

    async copyPrimaryKey(node: StorageAccountNode) {
        var primaryKey = await node.getPrimaryKey();
        copypaste.copy(primaryKey.value);
    }
}
