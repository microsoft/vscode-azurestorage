/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const loadStartTime: number = Date.now();
let loadEndTime: number;

import * as vscode from 'vscode';
import { commands } from 'vscode';
import { AzureTreeDataProvider, AzureTreeItem, AzureUserInput, callWithTelemetryAndErrorHandling, createApiProvider, createTelemetryReporter, IActionContext, registerCommand, registerUIExtensionVariables, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
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
import { StorageAccountTreeItem } from './azureStorageExplorer/storageAccounts/storageAccountNode';
import { registerTableActionHandlers } from './azureStorageExplorer/tables/tableActionHandlers';
import { registerTableGroupActionHandlers } from './azureStorageExplorer/tables/tableGroupActionHandlers';
import { ext } from './extensionVariables';
import { ICopyUrl } from './ICopyUrl';

export async function activate(context: vscode.ExtensionContext): Promise<AzureExtensionApiProvider> {
    console.log('Extension "Azure Storage Tools" is now active.');

    ext.context = context;
    ext.reporter = createTelemetryReporter(context);
    ext.ui = new AzureUserInput(context.globalState);
    ext.outputChannel = vscode.window.createOutputChannel("Azure Storage");
    context.subscriptions.push(ext.outputChannel);
    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('azureStorage.activate', async function (this: IActionContext): Promise<void> {
        this.properties.isActivationEvent = 'true';
        this.measurements.mainFileLoad = (loadEndTime - loadStartTime) / 1000;

        const tree = new AzureTreeDataProvider(StorageAccountProvider, 'azureStorage.loadMore');
        ext.tree = tree;

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
        registerCommand("azureStorage.openInPortal", async (treeItem?: AzureTreeItem) => {
            if (!treeItem) {
                treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue);
            }

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

loadEndTime = Date.now();
