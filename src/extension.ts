'use strict';
import * as vscode from 'vscode';
/*
import { AzureStorgeProvider } from './explorer/azureStorage'
*/

import { AzureTreeDataProvider } from './azureServiceExplorer/azureTreeDataProvider';
import { AccountManager } from './azureServiceExplorer/accountManager';
import { StorageSubscriptionChildProvider } from "./azureStroageExplorer/storageSubscriptionChildProvider";

import { BlobContainerActionHandler } from "./azureStroageExplorer/blobContainers/blobContainerActionHandler"
import { FileShareActionHandler } from "./azureStroageExplorer/fileShares/fileShareActionHandler";
import { QueueActionHandler } from "./azureStroageExplorer/queues/queueActionHandler";
import { TableActionHandler } from "./azureStroageExplorer/tables/tableActionHandler";
import { StorageAccountActionHandler } from "./azureStroageExplorer/storageAccounts/storageAccountActionHandler";
import { LoadMoreActionHandler } from './azureServiceExplorer/loadMoreActionHandler';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "Azure Storage Tools" is now active.');
	// const rootPath = vscode.workspace.rootPath;

	const azureAccount = new AccountManager(context);
	const azureTreeDataProvider = new AzureTreeDataProvider(azureAccount);

	var subscriptionChildrenProvider = new StorageSubscriptionChildProvider();
	azureTreeDataProvider.registerSubscriptionChildrenProvider(subscriptionChildrenProvider);
	new BlobContainerActionHandler().registerActions(context);
	new FileShareActionHandler().registerActions(context);
	new QueueActionHandler().registerActions(context);
	new TableActionHandler().registerActions(context);
	new StorageAccountActionHandler().registerActions(context);
	new LoadMoreActionHandler().registerActions(context);

	vscode.window.registerTreeDataProvider('azureStorage', azureTreeDataProvider);
	vscode.commands.registerCommand('azureStorage.refresh', () => azureTreeDataProvider.refresh());
}
