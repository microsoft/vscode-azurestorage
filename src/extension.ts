/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { Reporter, reporter } from './components/telemetry/reporter';
import * as vscode from 'vscode';
/*
import { AzureStorgeProvider } from './explorer/azureStorage'
*/

import { AzureTreeDataProvider, AzureActionHandler, IAzureNode } from 'vscode-azureextensionui';
import { StorageAccountProvider } from './azureStorageExplorer/storageAccountProvider';
import { azureStorageOutputChannel } from './azureStorageExplorer/azureStorageOutputChannel';
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
import { registerStorageAccountActionHandlers } from './azureStorageExplorer/storageAccounts/storageAccountActionHandlers';
import { registerTableActionHandlers } from './azureStorageExplorer/tables/tableActionHandlers';
import { registerTableGroupActionHandlers } from './azureStorageExplorer/tables/tableGroupActionHandlers';
import { commands } from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
    console.log('Extension "Azure Storage Tools" is now active.');
    // const rootPath = vscode.workspace.rootPath;

    context.subscriptions.push(new Reporter(context));

    const actionHandler: AzureActionHandler = new AzureActionHandler(context, azureStorageOutputChannel, reporter);

    const azureTreeDataProvider = new AzureTreeDataProvider(new StorageAccountProvider(), 'azureStorage.loadMoreNode', undefined, reporter);
    registerBlobActionHandlers(actionHandler);
    registerBlobContainerActionHandlers(actionHandler, context);
    registerBlobContainerGroupActionHandlers(actionHandler);
    registerFileActionHandlers(actionHandler);
    registerDirectoryActionHandlers(actionHandler);
    registerFileShareActionHandlers(actionHandler, context);
    registerFileShareGroupActionHandlers(actionHandler);
    registerLoadMoreActionHandler(actionHandler, azureTreeDataProvider);
    registerQueueActionHandlers(actionHandler);
    registerQueueGroupActionHandlers(actionHandler);
    registerStorageAccountActionHandlers(actionHandler);
    registerTableActionHandlers(actionHandler);
    registerTableGroupActionHandlers(actionHandler);

    vscode.window.registerTreeDataProvider('azureStorage', azureTreeDataProvider);
    actionHandler.registerCommand('azureStorage.refresh', (node?: IAzureNode) => azureTreeDataProvider.refresh(node));
    actionHandler.registerCommand('azureStorage.selectSubscriptions', () => commands.executeCommand("azure-account.selectSubscriptions"));
}
