/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import { commands } from 'vscode';
import { AzExtTreeDataProvider, AzExtTreeItem, AzureWizard, callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, IActionContext, openInPortal, registerCommand, registerErrorHandler, registerReportIssueCommand, registerUIExtensionVariables } from 'vscode-azureextensionui';
import { AzureExtensionApi, AzureExtensionApiProvider } from 'vscode-azureextensionui/api';
import { AzureStorageFS } from './AzureStorageFS';
import { revealTreeItem } from './commands/api/revealTreeItem';
import { registerBlobActionHandlers } from './commands/blob/blobActionHandlers';
import { registerBlobContainerActionHandlers } from './commands/blob/blobContainerActionHandlers';
import { registerBlobContainerGroupActionHandlers } from './commands/blob/blobContainerGroupActionHandlers';
import { createStorageAccount, createStorageAccountAdvanced } from './commands/createStorageAccount';
import { detachStorageAccount } from './commands/detachStorageAccount';
import { download } from './commands/downloadFile';
import { registerDirectoryActionHandlers } from './commands/fileShare/directoryActionHandlers';
import { registerFileActionHandlers } from './commands/fileShare/fileActionHandlers';
import { registerFileShareActionHandlers } from './commands/fileShare/fileShareActionHandlers';
import { registerFileShareGroupActionHandlers } from './commands/fileShare/fileShareGroupActionHandlers';
import { IOpenInFileExplorerWizardContext } from './commands/openInFileExplorer/IOpenInFileExplorerWizardContext';
import { OpenBehaviorStep } from './commands/openInFileExplorer/OpenBehaviorStep';
import { OpenTreeItemStep } from './commands/openInFileExplorer/OpenTreeItemStep';
import { registerQueueActionHandlers } from './commands/queue/queueActionHandlers';
import { registerQueueGroupActionHandlers } from './commands/queue/queueGroupActionHandlers';
import { selectStorageAccountTreeItemForCommand } from './commands/selectStorageAccountNodeForCommand';
import { EmulatorType, startEmulator } from './commands/startEmulator';
import { registerStorageAccountActionHandlers } from './commands/storageAccountActionHandlers';
import { registerTableActionHandlers } from './commands/table/tableActionHandlers';
import { registerTableGroupActionHandlers } from './commands/table/tableGroupActionHandlers';
import { uploadFiles } from './commands/uploadFiles';
import { uploadFolder } from './commands/uploadFolder';
import { uploadToAzureStorage } from './commands/uploadToAzureStorage';
import { azuriteExtensionId, emulatorTimeoutMS as startEmulatorDebounce } from './constants';
import { ext } from './extensionVariables';
import { AzureAccountTreeItem } from './tree/AzureAccountTreeItem';
import { BlobContainerTreeItem } from './tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from './tree/fileShare/FileShareTreeItem';
import { ICopyUrl } from './tree/ICopyUrl';
import { StorageAccountTreeItem } from './tree/StorageAccountTreeItem';

export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }, ignoreBundle?: boolean): Promise<AzureExtensionApiProvider> {
    ext.context = context;
    ext.ignoreBundle = ignoreBundle;
    ext.outputChannel = createAzExtOutputChannel('Azure Storage', ext.prefix);
    context.subscriptions.push(ext.outputChannel);
    registerUIExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        const azureAccountTreeItem = new AzureAccountTreeItem();
        context.subscriptions.push(azureAccountTreeItem);
        ext.tree = new AzExtTreeDataProvider(azureAccountTreeItem, 'azureStorage.loadMore');
        ext.treeView = vscode.window.createTreeView(ext.prefix, { treeDataProvider: ext.tree, showCollapseAll: true, canSelectMany: true });
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

        ext.azureStorageFS = new AzureStorageFS();
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider('azurestorage', ext.azureStorageFS, { isCaseSensitive: true }));
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('azurestorage', ext.azureStorageFS));

        registerCommand('azureStorage.showOutputChannel', () => { ext.outputChannel.show(); });
        registerCommand('azureStorage.openInFileExplorer', async (actionContext: IActionContext, treeItem?: BlobContainerTreeItem | FileShareTreeItem) => {
            if (!treeItem) {
                treeItem = <BlobContainerTreeItem | FileShareTreeItem>(await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext));
            }

            const wizardContext: IOpenInFileExplorerWizardContext = Object.assign(actionContext, { treeItem });
            if (treeItem.root.isEmulated) {
                wizardContext.openBehavior = 'OpenInNewWindow';
            }
            const wizard: AzureWizard<IOpenInFileExplorerWizardContext> = new AzureWizard(wizardContext, {
                promptSteps: [new OpenBehaviorStep()],
                executeSteps: [new OpenTreeItemStep()]
            });
            await wizard.prompt();
            await wizard.execute();
        });
        registerCommand('azureStorage.refresh', async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => ext.tree.refresh(actionContext, treeItem));
        registerCommand('azureStorage.loadMore', async (actionContext: IActionContext, treeItem: AzExtTreeItem) => await ext.tree.loadMore(treeItem, actionContext));
        registerCommand('azureStorage.copyUrl', (_actionContext: IActionContext, treeItem: AzExtTreeItem & ICopyUrl) => treeItem.copyUrl());
        registerCommand('azureStorage.selectSubscriptions', () => commands.executeCommand("azure-account.selectSubscriptions"));
        registerCommand("azureStorage.openInPortal", async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
            if (!treeItem) {
                treeItem = <StorageAccountTreeItem>await ext.tree.showTreeItemPicker(StorageAccountTreeItem.contextValue, actionContext);
            }

            await openInPortal(treeItem, treeItem.fullId);
        });
        registerCommand("azureStorage.configureStaticWebsite", async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
            const accountTreeItem = await selectStorageAccountTreeItemForCommand(
                treeItem,
                actionContext,
                {
                    mustBeWebsiteCapable: true,
                    configureWebsite: false
                });
            await accountTreeItem.configureStaticWebsite(actionContext);
        });
        registerCommand("azureStorage.disableStaticWebsite", async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
            const accountTreeItem = await selectStorageAccountTreeItemForCommand(
                treeItem,
                actionContext,
                {
                    mustBeWebsiteCapable: false,
                    configureWebsite: false
                });
            await accountTreeItem.disableStaticWebsite(actionContext);
        });
        registerCommand("azureStorage.createGpv2Account", createStorageAccount);
        registerCommand("azureStorage.createGpv2AccountAdvanced", createStorageAccountAdvanced);
        registerCommand('azureStorage.browseStaticWebsite', async (actionContext: IActionContext, treeItem?: AzExtTreeItem) => {
            const accountTreeItem = await selectStorageAccountTreeItemForCommand(
                treeItem,
                actionContext,
                {
                    mustBeWebsiteCapable: true,
                    configureWebsite: false
                });
            await accountTreeItem.browseStaticWebsite(actionContext);
        });

        // Suppress "Report an Issue" button for all errors in favor of the command
        registerErrorHandler(c => c.errorHandling.suppressReportIssue = true);
        registerReportIssueCommand('azureStorage.reportIssue');
    });
    registerCommand("azureStorage.uploadFiles", uploadFiles);
    registerCommand("azureStorage.uploadFolder", uploadFolder);
    registerCommand("azureStorage.uploadToAzureStorage", uploadToAzureStorage);
    registerCommand('azureStorage.download', download);
    registerCommand("azureStorage.attachStorageAccount", async (actionContext: IActionContext) => {
        await ext.attachedStorageAccountsTreeItem.attachWithConnectionString(actionContext);
    });
    registerCommand('azureStorage.detachStorageAccount', detachStorageAccount);
    registerCommand('azureStorage.startBlobEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.blob); }, startEmulatorDebounce);
    registerCommand('azureStorage.startQueueEmulator', async (actionContext: IActionContext) => { await startEmulator(actionContext, EmulatorType.queue); }, startEmulatorDebounce);
    registerCommand('azureStorage.showAzuriteExtension', async () => { await commands.executeCommand('extension.open', azuriteExtensionId); });

    return createApiProvider([<AzureExtensionApi>{
        revealTreeItem,
        apiVersion: '1.0.0'
    }]);
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}
