/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { FileShareNode } from './fileShareNode';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler, IAzureParentNode } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { FileFileHandler } from './fileFileHandler';
import { azureStorageOutputChannel } from '../azureStorageOutputChannel';
import { DirectoryNode } from './directoryNode';
import { FileNode } from './fileNode';

export function registerFileShareActionHandlers(actionHandler: AzureActionHandler, context: vscode.ExtensionContext): void {
    const _editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt", azureStorageOutputChannel);

    context.subscriptions.push(_editor);

    actionHandler.registerCommand("azureStorage.openFileShare", openFileShareInStorageExplorer);
    actionHandler.registerCommand("azureStorage.editFile", (node) => _editor.showEditor(node));
    actionHandler.registerCommand("azureStorage.deleteFileShare", (node: IAzureParentNode<FileShareNode>) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.createDirectory", (node: IAzureParentNode<FileShareNode>) => node.createChild(DirectoryNode.contextValue));
    actionHandler.registerCommand("azureStorage.createTextFile", (node: IAzureParentNode<FileShareNode>) => node.createChild(FileNode.contextValue));
    actionHandler.registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, (trackTelemetry: () => void, doc: vscode.TextDocument) => _editor.onDidSaveTextDocument(trackTelemetry, doc));
}

function openFileShareInStorageExplorer(node: IAzureNode<FileShareNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;
    let subscriptionid = node.subscription.subscriptionId;
    const resourceType = 'Azure.FileShare';
    let resourceName = node.treeItem.share.name;

    return storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}
