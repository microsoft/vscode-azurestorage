/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from '../../azureServiceExplorer/actions/baseActionHandler';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';

export class StorageAccountActionHandler extends BaseActionHandler {
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.openStorageAccount", (node) => { this.openStorageAccountInStorageExplorer(node) });
    }

    openStorageAccountInStorageExplorer(node) {
        var resourceId = node.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        
        StorageExplorerLauncher.openResource(resourceId, subscriptionid);
    }
}
