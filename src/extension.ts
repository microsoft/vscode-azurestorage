/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { commands } from 'vscode';
import { AzureTreeDataProvider, AzureTreeItem, AzureUserInput, createTelemetryReporter, IActionContext, IAzureUserInput, registerCommand, registerUIExtensionVariables } from 'vscode-azureextensionui';
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
import { selectStorageAccountTreeItemForCommand } from './azureStorageExplorer/selectStorageAccountNodeForCommand';
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

    const tree = new AzureTreeDataProvider(StorageAccountProvider, 'azureStorage.loadMore');
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
    registerCommand('azureStorage.refresh', async (treeItem?: AzureTreeItem) => await tree.refresh(treeItem));
    registerCommand('azureStorage.copyUrl', (treeItem: AzureTreeItem & ICopyUrl) => treeItem.copyUrl());
    registerCommand('azureStorage.selectSubscriptions', () => commands.executeCommand("azure-account.selectSubscriptions"));
    registerCommand("azureStorage.openInPortal", (treeItem: AzureTreeItem) => {
        treeItem.openInPortal();
    });
    registerCommand("azureStorage.configureStaticWebsite", async function (this: IActionContext, treeItem?: AzureTreeItem): Promise<void> {
        let accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            this,
            {
                mustBeWebsiteCapable: true,
                askToConfigureWebsite: false
            });
        await accountTreeItem.configureStaticWebsite();
    });
    registerCommand('azureStorage.browseStaticWebsite', async function (this: IActionContext, treeItem?: AzureTreeItem): Promise<void> {
        let accountTreeItem = await selectStorageAccountTreeItemForCommand(
            treeItem,
            this,
            {
                mustBeWebsiteCapable: true,
                askToConfigureWebsite: true
            });
        await accountTreeItem.browseStaticWebsite();
    });
}
