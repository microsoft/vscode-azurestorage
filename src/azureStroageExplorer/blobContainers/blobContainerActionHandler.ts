/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from '../../azureServiceExplorer/actions/baseActionHandler';

import { BlobContainerNode } from './blobContainerNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';

export class BlobContainerActionHandler extends BaseActionHandler {
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.openBlobContainer", (node) => { this.openBlobContainerInStorageExplorer(node) });
    }

    openBlobContainerInStorageExplorer(node: BlobContainerNode) {
        var resourceId = node.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        var resourceType = "Azure.BlobContainer";
        var resourceName = node.container.name;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
    }
}
