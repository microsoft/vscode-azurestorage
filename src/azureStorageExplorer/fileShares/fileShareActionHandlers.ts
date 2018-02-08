/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { FileShareNode } from './fileShareNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler, IAzureParentNode } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { FileFileHandler } from './fileFileHandler';
import { AzureStorageOutputChannel } from '../azureStorageOutputChannel';
import { DirectoryNode } from './directoryNode';
import { FileNode } from './fileNode';

export function registerFileShareActionHandlers(actionHandler: AzureActionHandler, context: vscode.ExtensionContext): void {
    const _editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt", AzureStorageOutputChannel);

    context.subscriptions.push(_editor);

    actionHandler.registerCommand("azureStorage.openFileShare", (node: IAzureParentNode<FileShareNode>) => { openFileShareInStorageExplorer(node) });
    actionHandler.registerCommand("azureStorage.editFile", (node) => { _editor.showEditor(node) });
    actionHandler.registerCommand("azureStorage.deleteFileShare", (node: IAzureParentNode<FileShareNode>) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.createDirectory", (node: IAzureParentNode<FileShareNode>) => node.createChild(DirectoryNode.contextValue));
    actionHandler.registerCommand("azureStorage.createTextFile", (node: IAzureParentNode<FileShareNode>) => node.createChild(FileNode.contextValue));
    actionHandler.registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, (trackTelemetry: () => void, doc: vscode.TextDocument) => _editor.onDidSaveTextDocument(trackTelemetry, doc));


}

function openFileShareInStorageExplorer(node: IAzureNode<FileShareNode>) {
    var resourceId = node.treeItem.storageAccount.id;
    var subscriptionid = node.subscription.subscriptionId;
    var resourceType = "Azure.FileShare";
    var resourceName = node.treeItem.share.name;

    StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
}
