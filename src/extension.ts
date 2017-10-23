'use strict';
import * as vscode from 'vscode';
/*
import { AzureStorgeProvider } from './explorer/azureStorage'
*/

import { AzureTreeDataProvider } from './AzureServiceExplorer/AzureTreeDataProvider';
import { AccountManager } from './AzureServiceExplorer/AccountManager';
import { StorageSubscriptionChildProvider } from "./AzureStroageExplorer/StorageSubscriptionChildProvider";

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "Azure Storage Tools" is now active.');
	// const rootPath = vscode.workspace.rootPath;

	const azureAccount = new AccountManager(context);
	const azureTreeDataProvider = new AzureTreeDataProvider(azureAccount);

	var subscriptionChildrenProvider = new StorageSubscriptionChildProvider();
	azureTreeDataProvider.registerSubscriptionChildrenProvider(subscriptionChildrenProvider);

	vscode.window.registerTreeDataProvider('azureStorage', azureTreeDataProvider);
	
	vscode.commands.registerCommand('azureStorage.refreshEntry', () => azureTreeDataProvider.refresh());
}
