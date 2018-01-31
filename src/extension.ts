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
import { StorageAccountProvider } from './azureStroageExplorer/storageAccountProvider';
import { AzureStorageOutputChannel } from './azureStroageExplorer/azureStorageOutputChannel';
import { RegisterBlobActionHandlers } from './azureStroageExplorer/blobContainers/blobActionHandlers';
import { RegisterBlobContainerActionHandlers } from './azureStroageExplorer/blobContainers/blobContainerActionHandlers';
import { RegisterBlobContainerGroupActionHandlers } from './azureStroageExplorer/blobContainers/blobContainerGroupActionHandlers';
import { RegisterDirectoryActionHandlers } from './azureStroageExplorer/fileShares/directoryActionHandlers';
import { RegisterFileActionHandlers } from './azureStroageExplorer/fileShares/fileActionHandlers';
import { RegisterFileShareActionHandlers } from './azureStroageExplorer/fileShares/fileShareActionHandlers';
import { RegisterFileShareGroupActionHandlers } from './azureStroageExplorer/fileShares/fileShareGroupActionHandlers';
import { RegisterLoadMoreActionHandler } from './azureStroageExplorer/loadMoreActionHandler';
import { RegisterQueueActionHandlers } from './azureStroageExplorer/queues/queueActionHandlers';
import { RegisterQueueGroupActionHandlers } from './azureStroageExplorer/queues/queueGroupActionHandlers';
import { RegisterStorageAccountActionHandlers } from './azureStroageExplorer/storageAccounts/storageAccountActionHandlers';
import { RegisterTableActionHandlers } from './azureStroageExplorer/tables/tableActionHandlers';
import { RegisterTableGroupActionHandlers } from './azureStroageExplorer/tables/tableGroupActionHandlers';

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
