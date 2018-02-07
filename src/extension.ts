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

import { AzureTreeDataProvider, AzureActionHandler } from 'vscode-azureextensionui';
import { StorageAccountProvider } from './azureStorageExplorer/storageAccountProvider';
import { AzureStorageOutputChannel } from './azureStorageExplorer/azureStorageOutputChannel';
import { RegisterBlobActionHandlers } from './azureStorageExplorer/blobContainers/blobActionHandlers';
import { RegisterBlobContainerActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerActionHandlers';
import { RegisterBlobContainerGroupActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerGroupActionHandlers';
import { RegisterDirectoryActionHandlers } from './azureStorageExplorer/fileShares/directoryActionHandlers';
import { RegisterFileActionHandlers } from './azureStorageExplorer/fileShares/fileActionHandlers';
import { RegisterFileShareActionHandlers } from './azureStorageExplorer/fileShares/fileShareActionHandlers';
import { RegisterFileShareGroupActionHandlers } from './azureStorageExplorer/fileShares/fileShareGroupActionHandlers';
import { RegisterLoadMoreActionHandler } from './azureStorageExplorer/loadMoreActionHandler';
import { RegisterQueueActionHandlers } from './azureStorageExplorer/queues/queueActionHandlers';
import { RegisterQueueGroupActionHandlers } from './azureStorageExplorer/queues/queueGroupActionHandlers';
import { RegisterStorageAccountActionHandlers } from './azureStorageExplorer/storageAccounts/storageAccountActionHandlers';
import { RegisterTableActionHandlers } from './azureStorageExplorer/tables/tableActionHandlers';
import { RegisterTableGroupActionHandlers } from './azureStorageExplorer/tables/tableGroupActionHandlers';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "Azure Storage Tools" is now active.');
    // const rootPath = vscode.workspace.rootPath;

    context.subscriptions.push(new Reporter(context));

    const actionHandler: AzureActionHandler = new AzureActionHandler(context, AzureStorageOutputChannel, reporter);

    const azureTreeDataProvider = new AzureTreeDataProvider(new StorageAccountProvider(), 'azureStorage.loadMoreNode');
    RegisterBlobActionHandlers(actionHandler);
    RegisterBlobContainerActionHandlers(actionHandler, context);
    RegisterBlobContainerGroupActionHandlers(actionHandler);
    RegisterFileActionHandlers(actionHandler);
    RegisterDirectoryActionHandlers(actionHandler);
    RegisterFileShareActionHandlers(actionHandler, context);
    RegisterFileShareGroupActionHandlers(actionHandler);
    RegisterLoadMoreActionHandler(actionHandler, azureTreeDataProvider);
    RegisterQueueActionHandlers(actionHandler);
    RegisterQueueGroupActionHandlers(actionHandler);
    RegisterStorageAccountActionHandlers(actionHandler);
    RegisterTableActionHandlers(actionHandler);
    RegisterTableGroupActionHandlers(actionHandler);

    vscode.window.registerTreeDataProvider('azureStorage', azureTreeDataProvider);
    vscode.commands.registerCommand('azureStorage.refresh', () => azureTreeDataProvider.refresh());
}
