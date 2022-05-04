/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { registerAzureUtilsExtensionVariables } from '@microsoft/vscode-azext-azureutils';
import { AzExtTreeItem, AzureWizard, callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, IActionContext, registerCommand, registerErrorHandler, registerReportIssueCommand, registerUIExtensionVariables } from '@microsoft/vscode-azext-utils';
import { AzureExtensionApi, AzureExtensionApiProvider } from '@microsoft/vscode-azext-utils/api';
import { AzureHostExtensionApi } from '@microsoft/vscode-azext-utils/hostapi';
import * as vscode from 'vscode';
import { commands } from 'vscode';
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
import { getApiExport } from './getApiExport';
import { StorageAccountResolver } from './StorageAccountResolver';
import { StorageWorkspaceProvider } from './StorageWorkspaceProvider';
import { BlobContainerTreeItem } from './tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from './tree/fileShare/FileShareTreeItem';
import { ICopyUrl } from './tree/ICopyUrl';
import { IStorageTreeItem } from './tree/IStorageTreeItem';
import { refreshTreeItem } from './tree/refreshTreeItem';

export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }, ignoreBundle?: boolean): Promise<AzureExtensionApiProvider> {
    ext.context = context;
    ext.ignoreBundle = ignoreBundle;
    ext.outputChannel = createAzExtOutputChannel('Azure Storage', ext.prefix);
    context.subscriptions.push(ext.outputChannel);
    registerUIExtensionVariables(ext);
    registerAzureUtilsExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

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
        ext.azureStorageWorkspaceFS = new AzureStorageFS();
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider('azurestorage', ext.azureStorageFS, { isCaseSensitive: true }));
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('azurestorage', ext.azureStorageFS));

        registerCommand('azureStorage.refresh', async (actionContext: IActionContext, treeItem?: AzExtTreeItem & IStorageTreeItem) => { await refreshTreeItem(actionContext, treeItem) })
        registerCommand('azureStorage.showOutputChannel', () => { ext.outputChannel.show(); });
        registerCommand('azureStorage.openInFileExplorer', async (actionContext: IActionContext, treeItem?: BlobContainerTreeItem | FileShareTreeItem) => {
            if (!treeItem) {
                treeItem = <BlobContainerTreeItem | FileShareTreeItem>(await ext.rgApi.appResourceTree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext));
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
        registerCommand('azureStorage.copyUrl', (_actionContext: IActionContext, treeItem: AzExtTreeItem & ICopyUrl) => treeItem.copyUrl());
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

    const rgApiProvider = await getApiExport<AzureExtensionApiProvider>('ms-azuretools.vscode-azureresourcegroups');
    if (rgApiProvider) {
        const api = rgApiProvider.getApi<AzureHostExtensionApi>('0.0.1');
        ext.rgApi = api;
        api.registerApplicationResourceResolver('microsoft.storage/storageaccounts', new StorageAccountResolver());
        ext.rgApi.registerWorkspaceResourceProvider('ms-azuretools.vscode-cosmosdb', new StorageWorkspaceProvider());
    } else {
        throw new Error('Could not find the Azure Resource Groups extension');
    }

    return createApiProvider([<AzureExtensionApi>{
        revealTreeItem,
        apiVersion: '1.0.0'
    }]);
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}
