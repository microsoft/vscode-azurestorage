/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { AzureActionHandler, IActionContext, IAzureNode, IAzureParentNode } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { azureStorageOutputChannel } from '../azureStorageOutputChannel';
import { DirectoryNode } from './directoryNode';
import { FileFileHandler } from './fileFileHandler';
import { FileNode } from './fileNode';
import { FileShareNode } from './fileShareNode';

export function registerFileShareActionHandlers(actionHandler: AzureActionHandler, context: vscode.ExtensionContext): void {
    const _editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt", azureStorageOutputChannel);

    context.subscriptions.push(_editor);

    actionHandler.registerCommand("azureStorage.openFileShare", openFileShareInStorageExplorer);
    actionHandler.registerCommand("azureStorage.editFile", async (node: IAzureNode<FileNode>) => await _editor.showEditor(node));
    actionHandler.registerCommand("azureStorage.deleteFileShare", async (node: IAzureParentNode<FileShareNode>) => await node.deleteNode());
    actionHandler.registerCommand("azureStorage.createDirectory", async (node: IAzureParentNode<FileShareNode>) => await node.createChild(DirectoryNode.contextValue));
    actionHandler.registerCommand("azureStorage.createTextFile", async (node: IAzureParentNode<FileShareNode>) => {
        let childNode = await node.createChild(FileNode.contextValue);
        await vscode.commands.executeCommand("azureStorage.editFile", childNode);
    });
    actionHandler.registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await _editor.onDidSaveTextDocument(this, doc); });
}

async function openFileShareInStorageExplorer(node: IAzureNode<FileShareNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;
    let subscriptionid = node.subscriptionId;
    const resourceType = 'Azure.FileShare';
    let resourceName = node.treeItem.share.name;

    await storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}
