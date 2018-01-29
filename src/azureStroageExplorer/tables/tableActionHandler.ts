/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableNode } from './tableNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export class TableActionHandler extends AzureActionHandler {
    registerActions() {
        this.registerCommand("azureStorage.openTable", (node) => { this.openTableInStorageExplorer(node) });
    }

    openTableInStorageExplorer(node: IAzureNode<TableNode>) {
        var resourceId = node.treeItem.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        var resourceType = "Azure.Table";
        var resourceName = node.treeItem.tableName;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
    }
}
