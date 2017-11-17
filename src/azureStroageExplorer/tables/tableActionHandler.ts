/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from '../../azureServiceExplorer/actions/baseActionHandler';

import { TableNode } from './tableNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';

export class TableActionHandler extends BaseActionHandler {
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.openTable", (node) => { this.openTableInStorageExplorer(node) });
    }

    openTableInStorageExplorer(node: TableNode) {
        var resourceId = node.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        var resourceType = "Azure.Table";
        var resourceName = node.tableName;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
    }
}
