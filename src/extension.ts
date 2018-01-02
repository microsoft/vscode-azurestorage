/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { Reporter } from './components/telemetry/reporter';
import * as vscode from 'vscode';
/*
import { AzureStorgeProvider } from './explorer/azureStorage'
*/

import { BlobContainerActionHandler } from "./azureStroageExplorer/blobContainers/blobContainerActionHandler"
import { FileShareActionHandler } from "./azureStroageExplorer/fileShares/fileShareActionHandler";
import { QueueActionHandler } from "./azureStroageExplorer/queues/queueActionHandler";
import { TableActionHandler } from "./azureStroageExplorer/tables/tableActionHandler";
import { StorageAccountActionHandler } from "./azureStroageExplorer/storageAccounts/storageAccountActionHandler";
import { AzureTreeDataProvider } from 'vscode-azureextensionui';
import { StorageAccountProvider } from './azureStroageExplorer/storageAccountProvider';
import { LoadMoreActionHandler } from './azureStroageExplorer/loadMoreActionHandler';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "Azure Storage Tools" is now active.');
	// const rootPath = vscode.workspace.rootPath;

	context.subscriptions.push(new Reporter(context));

	const azureTreeDataProvider = new AzureTreeDataProvider(new StorageAccountProvider(), 'azureStorage.loadMoreNode');
	new BlobContainerActionHandler().registerActions(context);
	new FileShareActionHandler().registerActions(context);
	new QueueActionHandler().registerActions(context);
	new TableActionHandler().registerActions(context);
	new StorageAccountActionHandler().registerActions(context);
	new LoadMoreActionHandler(azureTreeDataProvider).registerActions(context);

	vscode.window.registerTreeDataProvider('azureStorage', azureTreeDataProvider);
	vscode.commands.registerCommand('azureStorage.refresh', () => azureTreeDataProvider.refresh());
}
