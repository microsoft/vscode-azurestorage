/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from '../../azureServiceExplorer/actions/baseActionHandler';

import { FileShareNode } from './fileShareNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';

export class FileShareActionHandler extends BaseActionHandler {
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.openFileShare", (node) => { this.openFileShareInStorageExplorer(node) });
    }

    openFileShareInStorageExplorer(node: FileShareNode) {
        var resourceId = node.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        var resourceType = "Azure.FileShare";
        var resourceName = node.share.name;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
    }
}
