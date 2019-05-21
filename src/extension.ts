/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { commands } from 'vscode';
import { AzExtTreeDataProvider, AzExtTreeItem, AzureTreeItem, AzureUserInput, callWithTelemetryAndErrorHandling, createApiProvider, createTelemetryReporter, IActionContext, registerCommand, registerUIExtensionVariables } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { AzureAccountTreeItem } from './azureStorageExplorer/AzureAccountTreeItem';
import { registerBlobActionHandlers } from './azureStorageExplorer/blobContainers/blobActionHandlers';
import { registerBlobContainerActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerActionHandlers';
import { registerBlobContainerGroupActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerGroupActionHandlers';
import { registerDirectoryActionHandlers } from './azureStorageExplorer/fileShares/directoryActionHandlers';
import { registerFileActionHandlers } from './azureStorageExplorer/fileShares/fileActionHandlers';
import { registerFileShareActionHandlers } from './azureStorageExplorer/fileShares/fileShareActionHandlers';
import { registerFileShareGroupActionHandlers } from './azureStorageExplorer/fileShares/fileShareGroupActionHandlers';
import { registerQueueActionHandlers } from './azureStorageExplorer/queues/queueActionHandlers';
import { registerQueueGroupActionHandlers } from './azureStorageExplorer/queues/queueGroupActionHandlers';
import { selectStorageAccountTreeItemForCommand } from './azureStorageExplorer/selectStorageAccountNodeForCommand';
import { registerStorageAccountActionHandlers } from './azureStorageExplorer/storageAccounts/storageAccountActionHandlers';
import { StorageAccountTreeItem } from './azureStorageExplorer/storageAccounts/storageAccountNode';
import { SubscriptionTreeItem } from './azureStorageExplorer/SubscriptionTreeItem';
import { registerTableActionHandlers } from './azureStorageExplorer/tables/tableActionHandlers';
import { registerTableGroupActionHandlers } from './azureStorageExplorer/tables/tableGroupActionHandlers';
import { ext } from './extensionVariables';
import { ICopyUrl } from './ICopyUrl';

export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }): Promise<AzureExtensionApiProvider> {
    console.log('Extension "Azure Storage Tools" is now active.');

    ext.context = context;
    ext.reporter = createTelemetryReporter(context);
    ext.ui = new AzureUserInput(context.globalState);
    ext.outputChannel = vscode.window.createOutputChannel("Azure Storage");
    context.subscriptions.push(ext.outputChannel);
    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('azureStorage.activate', async function (this: IActionContext): Promise<void> {
        this.properties.isActivationEvent = 'true';
        this.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        const azureAccountTreeItem = new AzureAccountTreeItem();
        context.subscriptions.push(azureAccountTreeItem);
        ext.tree = new AzExtTreeDataProvider(azureAccountTreeItem, 'azureStorage.loadMore');
        ext.treeView = vscode.window.createTreeView('azureStorage', { treeDataProvider: ext.tree });
        context.subscriptions.push(ext.treeView);

        registerBlobActionHandlers();
        registerBlobContainerActionHandlers();
        registerBlobContainerGroupActionHandlers();
        registerFileActionHandlers();
        registerDirectoryActionHandlers();
        registerFileShareActionHandlers();
        registerFileShareGroupActionHandlers();
        registerQueueActionHandlers();
        registerQueueGroupActionHandlers();
        registerStorageAccountActionHandlers();
        registerTableActionHandlers();
        registerTableGroupActionHandlers();

        registerCommand('azureStorage.refresh', async (treeItem?: AzExtTreeItem) => ext.tree.refresh(treeItem));
        registerCommand('azureStorage.loadMore', async (treeItem: AzExtTreeItem) => await ext.tree.loadMore(treeItem));
        registerCommand('azureStorage.copyUrl', (treeItem: AzureTreeItem & ICopyUrl) => treeItem.copyUrl());
        registerCommand('azureStorage.selectSubscriptions', () => commands.executeCommand("azure-account.selectSubscriptions"));
        registerCommand("azureStorage.openInPortal", async (treeItem?: AzureTreeItem) => {
            if (!treeItem) {
                treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue);
            }

            await treeItem.openInPortal();
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
        registerCommand("azureStorage.disableStaticWebsite", async function (this: IActionContext, treeItem?: AzureTreeItem): Promise<void> {
            let accountTreeItem = await selectStorageAccountTreeItemForCommand(
                treeItem,
                this,
                {
                    mustBeWebsiteCapable: false,
                    askToConfigureWebsite: false
                });
            await accountTreeItem.disableStaticWebsite();
        });
        registerCommand("azureStorage.createGpv2Account", async function (this: IActionContext, treeItem?: SubscriptionTreeItem): Promise<void> {
            let node = treeItem ? <SubscriptionTreeItem>treeItem : <SubscriptionTreeItem>await ext.tree.showTreeItemPicker(SubscriptionTreeItem.contextValue);

            await node.createChild(this);
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
    });

    return createApiProvider([]);
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}
