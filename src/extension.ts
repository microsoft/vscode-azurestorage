/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as vscode from 'vscode';
import { Reporter } from './components/telemetry/reporter';
/*
import { AzureStorgeProvider } from './explorer/azureStorage'
*/

import { commands } from 'vscode';
import { AzureTreeDataProvider, AzureUserInput, IAzureNode, IAzureTreeItem, IAzureUserInput, registerCommand, registerUIExtensionVariables } from 'vscode-azureextensionui';
import { registerBlobActionHandlers } from './azureStorageExplorer/blobContainers/blobActionHandlers';
import { registerBlobContainerActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerActionHandlers';
import { registerBlobContainerGroupActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerGroupActionHandlers';
import { BlobContainerNode } from './azureStorageExplorer/blobContainers/blobContainerNode';
import { registerDirectoryActionHandlers } from './azureStorageExplorer/fileShares/directoryActionHandlers';
import { registerFileActionHandlers } from './azureStorageExplorer/fileShares/fileActionHandlers';
import { registerFileShareActionHandlers } from './azureStorageExplorer/fileShares/fileShareActionHandlers';
import { registerFileShareGroupActionHandlers } from './azureStorageExplorer/fileShares/fileShareGroupActionHandlers';
import { registerLoadMoreActionHandler } from './azureStorageExplorer/loadMoreActionHandler';
import { registerQueueActionHandlers } from './azureStorageExplorer/queues/queueActionHandlers';
import { registerQueueGroupActionHandlers } from './azureStorageExplorer/queues/queueGroupActionHandlers';
import { StorageAccountProvider } from './azureStorageExplorer/storageAccountProvider';
import { registerStorageAccountActionHandlers } from './azureStorageExplorer/storageAccounts/storageAccountActionHandlers';
import { StorageAccountNode } from './azureStorageExplorer/storageAccounts/storageAccountNode';
import { registerTableActionHandlers } from './azureStorageExplorer/tables/tableActionHandlers';
import { registerTableGroupActionHandlers } from './azureStorageExplorer/tables/tableGroupActionHandlers';
import { ext } from './extensionVariables';
import { ICopyUrl } from './ICopyUrl';

export function activate(context: vscode.ExtensionContext): void {
    console.log('Extension "Azure Storage Tools" is now active.');

    registerUIExtensionVariables(ext);

    ext.context = context;
    ext.outputChannel = vscode.window.createOutputChannel("Azure Storage");
    context.subscriptions.push(ext.outputChannel);

    context.subscriptions.push(new Reporter(context));

    const ui: IAzureUserInput = new AzureUserInput(context.globalState);
    ext.ui = ui;

    const tree = new AzureTreeDataProvider(new StorageAccountProvider(), 'azureStorage.loadMoreNode');
    registerBlobActionHandlers();
    registerBlobContainerActionHandlers();
    registerBlobContainerGroupActionHandlers();
    registerFileActionHandlers();
    registerDirectoryActionHandlers();
    registerFileShareActionHandlers();
    registerFileShareGroupActionHandlers();
    registerLoadMoreActionHandler(tree);
    registerQueueActionHandlers();
    registerQueueGroupActionHandlers();
    registerStorageAccountActionHandlers(tree);
    registerTableActionHandlers();
    registerTableGroupActionHandlers();

    vscode.window.registerTreeDataProvider('azureStorage', tree);
    registerCommand('azureStorage.refresh', async (node?: IAzureNode) => await tree.refresh(node));
    registerCommand('azureStorage.copyUrl', (node?: IAzureNode<IAzureTreeItem & ICopyUrl>) => node.treeItem.copyUrl(node));
    registerCommand('azureStorage.selectSubscriptions', () => commands.executeCommand("azure-account.selectSubscriptions"));
    registerCommand("azureStorage.openInPortal", (node: IAzureNode<IAzureTreeItem>) => {
        node.openInPortal();
    });
    registerCommand("azureStorage.configureStaticWebsite", async (node: IAzureNode<IAzureTreeItem>) => {
        if (!node) {
            node = <IAzureNode<StorageAccountNode>>await tree.showNodePicker(StorageAccountNode.contextValue);
        }
        if (node.treeItem.contextValue === BlobContainerNode.contextValue) {
            // Currently the portal only allows configuring at the storage account level, so retrieve the storage account node
            let storageAccountNode = node.parent && node.parent.parent;
            console.assert(!!storageAccountNode && storageAccountNode.treeItem.contextValue === StorageAccountNode.contextValue, "Couldn't find storage account node for container");
            node = storageAccountNode;
        }

        let featureQuery = "feature.staticwebsites=true"; // Needed until preview is public
        let resourceId = `${node.id}/staticWebsite`;
        node.openInPortal(resourceId, { queryPrefix: featureQuery });
    });
}
