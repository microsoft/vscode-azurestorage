/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { commands } from 'vscode';
import { AzureTreeDataProvider, AzureUserInput, createTelemetryReporter, IActionContext, IAzureNode, IAzureTreeItem, IAzureUserInput, registerCommand, registerUIExtensionVariables } from 'vscode-azureextensionui';
import { registerBlobActionHandlers } from './azureStorageExplorer/blobContainers/blobActionHandlers';
import { registerBlobContainerActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerActionHandlers';
import { registerBlobContainerGroupActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerGroupActionHandlers';
import { registerDirectoryActionHandlers } from './azureStorageExplorer/fileShares/directoryActionHandlers';
import { registerFileActionHandlers } from './azureStorageExplorer/fileShares/fileActionHandlers';
import { registerFileShareActionHandlers } from './azureStorageExplorer/fileShares/fileShareActionHandlers';
import { registerFileShareGroupActionHandlers } from './azureStorageExplorer/fileShares/fileShareGroupActionHandlers';
import { registerLoadMoreActionHandler } from './azureStorageExplorer/loadMoreActionHandler';
import { registerQueueActionHandlers } from './azureStorageExplorer/queues/queueActionHandlers';
import { registerQueueGroupActionHandlers } from './azureStorageExplorer/queues/queueGroupActionHandlers';
import { selectStorageAccountNodeForCommand } from './azureStorageExplorer/selectStorageAccountNodeForCommand';
import { StorageAccountProvider } from './azureStorageExplorer/storageAccountProvider';
import { registerStorageAccountActionHandlers } from './azureStorageExplorer/storageAccounts/storageAccountActionHandlers';
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

    const ui: IAzureUserInput = new AzureUserInput(context.globalState);
    ext.ui = ui;

    const tree = new AzureTreeDataProvider(new StorageAccountProvider(), 'azureStorage.loadMore');
    ext.tree = tree;

    ext.reporter = createTelemetryReporter(context);

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
    registerStorageAccountActionHandlers();
    registerTableActionHandlers();
    registerTableGroupActionHandlers();

    vscode.window.registerTreeDataProvider('azureStorage', tree);
    registerCommand('azureStorage.refresh', async (node?: IAzureNode) => await tree.refresh(node));
    registerCommand('azureStorage.copyUrl', (node: IAzureNode<IAzureTreeItem & ICopyUrl>) => node.treeItem.copyUrl(node));
    registerCommand('azureStorage.selectSubscriptions', () => commands.executeCommand("azure-account.selectSubscriptions"));
    registerCommand("azureStorage.openInPortal", (node: IAzureNode<IAzureTreeItem>) => {
        node.openInPortal();
    });
    registerCommand("azureStorage.configureStaticWebsite", async function (this: IActionContext, node: IAzureNode<IAzureTreeItem>): Promise<void> {
        let accountNode = await selectStorageAccountNodeForCommand(
            node,
            this,
            {
                mustBeWebsiteCapable: true,
                askToConfigureWebsite: false
            });
        await accountNode.treeItem.configureStaticWebsite(accountNode);
    });
    registerCommand('azureStorage.browseStaticWebsite', async function (this: IActionContext, node: IAzureNode<IAzureTreeItem>): Promise<void> {
        let accountNode = await selectStorageAccountNodeForCommand(
            node,
            this,
            {
                mustBeWebsiteCapable: true,
                askToConfigureWebsite: true
            });
        await accountNode.treeItem.browseStaticWebsite(accountNode);
    });
}
