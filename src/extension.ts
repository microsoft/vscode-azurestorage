'use strict';
import * as vscode from 'vscode';
/*
import { AzureStorgeProvider } from './explorer/azureStorage'
*/

import { AzureTreeDataProvider } from './azureServiceExplorer/azureTreeDataProvider';
import { AccountManager } from './azureServiceExplorer/accountManager';
import { StorageSubscriptionChildProvider } from "./azureStroageExplorer/storageSubscriptionChildProvider";
import { BlobContainerActionHandler } from "./azureStroageExplorer/blobContainers/blobContainerActionHandler"

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "Azure Storage Tools" is now active.');
	// const rootPath = vscode.workspace.rootPath;

	const azureAccount = new AccountManager(context);
	const azureTreeDataProvider = new AzureTreeDataProvider(azureAccount);

	var subscriptionChildrenProvider = new StorageSubscriptionChildProvider();
	azureTreeDataProvider.registerSubscriptionChildrenProvider(subscriptionChildrenProvider);
	new BlobContainerActionHandler().registerActions(context);

	vscode.window.registerTreeDataProvider('azureStorage', azureTreeDataProvider);
	
	vscode.commands.registerCommand('azureStorage.refreshEntry', () => azureTreeDataProvider.refresh());
}
