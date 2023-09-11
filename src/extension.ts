/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { registerAzureUtilsExtensionVariables } from '@microsoft/vscode-azext-azureutils';
import { apiUtils, AzExtParentTreeItem, AzureExtensionApi, callWithTelemetryAndErrorHandling, createApiProvider, createAzExtOutputChannel, IActionContext, registerErrorHandler, registerReportIssueCommand, registerUIExtensionVariables } from '@microsoft/vscode-azext-utils';
import { AzureHostExtensionApi } from '@microsoft/vscode-azext-utils/hostapi';
import { AzExtResourceType } from '@microsoft/vscode-azureresources-api';
import * as vscode from 'vscode';
import { AzureStorageFS } from './AzureStorageFS';
import { BlobContainerFS } from './BlobContainerFS';
import { revealTreeItem } from './commands/api/revealTreeItem';
import { registerCommands } from './commands/registerCommands';
import { ext } from './extensionVariables';
import { StorageAccountResolver } from './StorageAccountResolver';
import { StorageWorkspaceProvider } from './StorageWorkspaceProvider';
import './tree/AttachedStorageAccountTreeItem';

export async function activate(context: vscode.ExtensionContext, perfStats: { loadStartTime: number; loadEndTime: number }, ignoreBundle?: boolean): Promise<apiUtils.AzureExtensionApiProvider> {
    // the entry point for vscode.dev is this activate, not main.js, so we need to instantiate perfStats here
    // the perf stats don't matter for vscode because there is no main file to load-- we may need to see if we can track the download time
    perfStats ||= { loadStartTime: Date.now(), loadEndTime: Date.now() };

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
        context.subscriptions.push(vscode.workspace.registerFileSystemProvider('azurestorageblob', new BlobContainerFS(), { isCaseSensitive: true }));
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('azurestorage', ext.azureStorageFS));

        // Suppress "Report an Issue" button for all errors in favor of the command
        registerErrorHandler(c => c.errorHandling.suppressReportIssue = true);
        registerReportIssueCommand('azureStorage.reportIssue');

        registerCommands();

        const rgApiProvider = await apiUtils.getExtensionExports<apiUtils.AzureExtensionApiProvider>('ms-azuretools.vscode-azureresourcegroups');
        if (rgApiProvider) {
            const api = rgApiProvider.getApi<AzureHostExtensionApi>('0.0.1');
            ext.rgApi = api;
            api.registerApplicationResourceResolver(AzExtResourceType.StorageAccounts, new StorageAccountResolver());

            const workspaceRootTreeItem = (ext.rgApi.workspaceResourceTree as unknown as { _rootTreeItem: AzExtParentTreeItem })._rootTreeItem;
            const storageWorkspaceProvider = new StorageWorkspaceProvider(workspaceRootTreeItem);
            ext.rgApi.registerWorkspaceResourceProvider('storageEmulator', storageWorkspaceProvider);
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
export function deactivate(): void {
    // Nothing to do
}
