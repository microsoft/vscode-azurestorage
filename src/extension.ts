/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { commands } from 'vscode';
import { AzExtTreeDataProvider, AzExtTreeItem, AzureTreeItem, AzureUserInput, AzureWizard, callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, createTelemetryReporter, IActionContext, IAzureQuickPickItem, registerCommand, registerUIExtensionVariables } from 'vscode-azureextensionui';
import { AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { AzureAccountTreeItem } from './azureStorageExplorer/AzureAccountTreeItem';
import { AzureStorageFS } from './azureStorageExplorer/AzureStorageFS';
import { registerBlobActionHandlers } from './azureStorageExplorer/blobContainers/blobActionHandlers';
import { registerBlobContainerActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerActionHandlers';
import { registerBlobContainerGroupActionHandlers } from './azureStorageExplorer/blobContainers/blobContainerGroupActionHandlers';
import { BlobContainerTreeItem } from './azureStorageExplorer/blobContainers/blobContainerNode';
import { createStorageAccount, createStorageAccountAdvanced } from './azureStorageExplorer/createStorageAccount';
import { registerDirectoryActionHandlers } from './azureStorageExplorer/fileShares/directoryActionHandlers';
import { registerFileActionHandlers } from './azureStorageExplorer/fileShares/fileActionHandlers';
import { registerFileShareActionHandlers } from './azureStorageExplorer/fileShares/fileShareActionHandlers';
import { registerFileShareGroupActionHandlers } from './azureStorageExplorer/fileShares/fileShareGroupActionHandlers';
import { FileShareTreeItem } from './azureStorageExplorer/fileShares/fileShareNode';
import { IOpenInFileExplorerWizardContext } from './azureStorageExplorer/openInFileExplorer/IOpenInFileExplorerWizardContext';
import { OpenBehaviorStep } from './azureStorageExplorer/openInFileExplorer/OpenBehaviorStep';
import { OpenTreeItemStep } from './azureStorageExplorer/openInFileExplorer/OpenTreeItemStep';
import { registerQueueActionHandlers } from './azureStorageExplorer/queues/queueActionHandlers';
import { registerQueueGroupActionHandlers } from './azureStorageExplorer/queues/queueGroupActionHandlers';
import { selectStorageAccountTreeItemForCommand } from './azureStorageExplorer/selectStorageAccountNodeForCommand';
import { registerStorageAccountActionHandlers } from './azureStorageExplorer/storageAccounts/storageAccountActionHandlers';
import { StorageAccountTreeItem } from './azureStorageExplorer/storageAccounts/storageAccountNode';
import { registerTableActionHandlers } from './azureStorageExplorer/tables/tableActionHandlers';
import { registerTableGroupActionHandlers } from './azureStorageExplorer/tables/tableGroupActionHandlers';
import { configurationSettingsKeys, extensionPrefix } from './constants';
import { ext } from './extensionVariables';
import { ICopyUrl } from './ICopyUrl';
import { localize } from './localize';

// tslint:disable-next-line:max-func-body-length
export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }): Promise<AzureExtensionApiProvider> {
    console.log('Extension "Azure Storage Tools" is now active.');

    ext.context = context;
    ext.reporter = createTelemetryReporter(context);
    ext.ui = new AzureUserInput(context.globalState);
    ext.outputChannel = createAzExtOutputChannel('Azure Storage', ext.prefix);
    context.subscriptions.push(ext.outputChannel);
    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', async (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        const azureAccountTreeItem = new AzureAccountTreeItem();
        context.subscriptions.push(azureAccountTreeItem);
        ext.tree = new AzExtTreeDataProvider(azureAccountTreeItem, 'azureStorage.loadMore');
        ext.treeView = vscode.window.createTreeView(ext.prefix, { treeDataProvider: ext.tree, showCollapseAll: true });
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

        // tslint:disable-next-line: strict-boolean-expressions
        if (vscode.workspace.getConfiguration(extensionPrefix).get(configurationSettingsKeys.enableViewInFileExplorer)) {
            context.subscriptions.push(vscode.workspace.registerFileSystemProvider('azurestorage', new AzureStorageFS(), { isCaseSensitive: true }));
        }
        registerCommand('azureStorage.openInFileExplorer', async (actionContext: IActionContext, treeItem?: BlobContainerTreeItem | FileShareTreeItem) => {
            await callWithTelemetryAndErrorHandling('azureStorage.openInFileExplorer', async () => {
                if (!treeItem) {
                    const placeHolder: string = localize('selectResourceTypeToOpenInFileExplorer', 'Select the resource type to open in File Explorer');
                    let quickPicks: IAzureQuickPickItem<string>[] = [
                        {
                            label: "Blob Container",
                            data: BlobContainerTreeItem.contextValue
                        },
                        {
                            label: "File Share",
                            data: FileShareTreeItem.contextValue
                        }];
                    let contextValue: string = (await ext.ui.showQuickPick(quickPicks, { placeHolder })).data;
                    treeItem = <BlobContainerTreeItem | FileShareTreeItem>await ext.tree.showTreeItemPicker(contextValue, actionContext);
                }

                const wizardContext: IOpenInFileExplorerWizardContext = Object.assign(actionContext, { treeItem });
                const wizard: AzureWizard<IOpenInFileExplorerWizardContext> = new AzureWizard(wizardContext, {
                    promptSteps: [new OpenBehaviorStep()],
                    executeSteps: [new OpenTreeItemStep()]
                });
                await wizard.prompt();
                await wizard.execute();
            });
        });
        registerCommand('azureStorage.refresh', async (_actionContext: IActionContext, treeItem?: AzExtTreeItem) => ext.tree.refresh(treeItem));
        registerCommand('azureStorage.loadMore', async (actionContext: IActionContext, treeItem: AzExtTreeItem) => await ext.tree.loadMore(treeItem, actionContext));
        registerCommand('azureStorage.copyUrl', (_actionContext: IActionContext, treeItem: AzureTreeItem & ICopyUrl) => treeItem.copyUrl());
        registerCommand('azureStorage.selectSubscriptions', () => commands.executeCommand("azure-account.selectSubscriptions"));
        registerCommand("azureStorage.openInPortal", async (actionContext: IActionContext, treeItem?: AzureTreeItem) => {
            if (!treeItem) {
                treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue, actionContext);
            }

            await treeItem.openInPortal();
        });
        registerCommand("azureStorage.configureStaticWebsite", async (actionContext: IActionContext, treeItem?: AzureTreeItem) => {
            let accountTreeItem = await selectStorageAccountTreeItemForCommand(
                treeItem,
                actionContext,
                {
                    mustBeWebsiteCapable: true,
                    askToConfigureWebsite: false
                });
            await accountTreeItem.configureStaticWebsite();
        });
        registerCommand("azureStorage.disableStaticWebsite", async (actionContext: IActionContext, treeItem?: AzureTreeItem) => {
            let accountTreeItem = await selectStorageAccountTreeItemForCommand(
                treeItem,
                actionContext,
                {
                    mustBeWebsiteCapable: false,
                    askToConfigureWebsite: false
                });
            await accountTreeItem.disableStaticWebsite();
        });
        registerCommand("azureStorage.createGpv2Account", createStorageAccount);
        registerCommand("azureStorage.createGpv2AccountAdvanced", createStorageAccountAdvanced);
        registerCommand('azureStorage.browseStaticWebsite', async (actionContext: IActionContext, treeItem?: AzureTreeItem) => {
            let accountTreeItem = await selectStorageAccountTreeItemForCommand(
                treeItem,
                actionContext,
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
