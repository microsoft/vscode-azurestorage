/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { registerAzureUtilsExtensionVariables } from '@microsoft/vscode-azext-azureutils';
import { AzExtParentTreeItem, callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, IActionContext, registerErrorHandler, registerReportIssueCommand, registerUIExtensionVariables } from '@microsoft/vscode-azext-utils';
import { AzureExtensionApi, AzureExtensionApiProvider } from '@microsoft/vscode-azext-utils/api';
import { AzureHostExtensionApi } from '@microsoft/vscode-azext-utils/hostapi';
import * as vscode from 'vscode';
import { AzureStorageFS } from './AzureStorageFS';
import { revealTreeItem } from './commands/api/revealTreeItem';
import { registerBlobActionHandlers } from './commands/blob/blobActionHandlers';
import { registerBlobContainerActionHandlers } from './commands/blob/blobContainerActionHandlers';
import { registerBlobContainerGroupActionHandlers } from './commands/blob/blobContainerGroupActionHandlers';
import { registerDirectoryActionHandlers } from './commands/fileShare/directoryActionHandlers';
import { registerFileActionHandlers } from './commands/fileShare/fileActionHandlers';
import { registerFileShareActionHandlers } from './commands/fileShare/fileShareActionHandlers';
import { registerFileShareGroupActionHandlers } from './commands/fileShare/fileShareGroupActionHandlers';
import { registerQueueActionHandlers } from './commands/queue/queueActionHandlers';
import { registerQueueGroupActionHandlers } from './commands/queue/queueGroupActionHandlers';
import { registerCommands } from './commands/registerCommands';
import { registerStorageAccountActionHandlers } from './commands/storageAccountActionHandlers';
import { registerTableActionHandlers } from './commands/table/tableActionHandlers';
import { registerTableGroupActionHandlers } from './commands/table/tableGroupActionHandlers';
import { ext } from './extensionVariables';
import { getApiExport } from './getApiExport';
import { StorageAccountResolver } from './StorageAccountResolver';
import { StorageWorkspaceProvider } from './StorageWorkspaceProvider';

export async function activateInternal(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }, ignoreBundle?: boolean): Promise<AzureExtensionApiProvider> {
    ext.context = context;
    ext.ignoreBundle = ignoreBundle;
    ext.outputChannel = createAzExtOutputChannel('Azure Storage', ext.prefix);
    context.subscriptions.push(ext.outputChannel);
    registerUIExtensionVariables(ext);
    registerAzureUtilsExtensionVariables(ext);

    await callWithTelemetryAndErrorHandling('activate', async (activateContext: IActionContext) => {
        activateContext.telemetry.properties.isActivationEvent = 'true';
        activateContext.telemetry.measurements.mainFileLoad = (perfStats.loadEndTime - perfStats.loadStartTime) / 1000;

        ext.azureStorageFS = new AzureStorageFS();
        ext.azureStorageWorkspaceFS = new AzureStorageFS();
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider('azurestorage', ext.azureStorageFS, { isCaseSensitive: true }));
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('azurestorage', ext.azureStorageFS));

        // Suppress "Report an Issue" button for all errors in favor of the command
        registerErrorHandler(c => c.errorHandling.suppressReportIssue = true);
        registerReportIssueCommand('azureStorage.reportIssue');

        registerCommands();

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

        const rgApiProvider = await getApiExport<AzureExtensionApiProvider>('ms-azuretools.vscode-azureresourcegroups');
        if (rgApiProvider) {
            const api = rgApiProvider.getApi<AzureHostExtensionApi>('0.0.1');
            ext.rgApi = api;
            api.registerApplicationResourceResolver('microsoft.storage/storageaccounts', new StorageAccountResolver());

            const workspaceRootTreeItem = (ext.rgApi.workspaceResourceTree as unknown as { _rootTreeItem: AzExtParentTreeItem })._rootTreeItem;
            const storageWorkspaceProvider = new StorageWorkspaceProvider(workspaceRootTreeItem);
            ext.rgApi.registerWorkspaceResourceProvider('ms-azuretools.vscode-azurestorage', storageWorkspaceProvider);
        } else {
            throw new Error('Could not find the Azure Resource Groups extension');
        }
    });

    return createApiProvider([<AzureExtensionApi>{
        revealTreeItem,
        apiVersion: '1.0.0'
    }]);
}

// this method is called when your extension is deactivated
export function deactivateInternal(): void {
    // Nothing to do
}
