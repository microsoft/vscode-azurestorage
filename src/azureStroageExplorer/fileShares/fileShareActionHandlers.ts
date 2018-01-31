/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { FileShareNode } from './fileShareNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { FileFileHandler } from './fileFileHandler';
import { AzureStorageOutputChannel } from '../azureStorageOutputChannel';

export function RegisterFileShareActionHandlers(actionHandler: AzureActionHandler, context: vscode.ExtensionContext): void {
    const _editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt", AzureStorageOutputChannel);

    context.subscriptions.push(_editor);

    actionHandler.registerCommand("azureStorage.openFileShare", (node) => { openFileShareInStorageExplorer(node) });
    actionHandler.registerCommand("azureStorage.editFile", (node) => { _editor.showEditor(node) });
    actionHandler.registerCommand("azureStorage.deleteFileShare", (node) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.createDirectory", (node) => node.createChild());
    actionHandler.registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, (trackTelemetry: () => void, doc: vscode.TextDocument) => _editor.onDidSaveTextDocument(trackTelemetry, doc));


}

function openFileShareInStorageExplorer(node: IAzureNode<FileShareNode>) {
    var resourceId = node.treeItem.storageAccount.id;
    var subscriptionid = node.subscription.subscriptionId;
    var resourceType = "Azure.FileShare";
    var resourceName = node.treeItem.share.name;

    StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
}
