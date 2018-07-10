/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { IActionContext, IAzureNode, IAzureParentNode, registerCommand, registerEvent } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { DirectoryNode } from './directoryNode';
import { FileFileHandler } from './fileFileHandler';
import { FileNode } from './fileNode';
import { FileShareNode } from './fileShareNode';

export function registerFileShareActionHandlers(): void {
    const _editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt");

    ext.context.subscriptions.push(_editor);

    registerCommand("azureStorage.openFileShare", openFileShareInStorageExplorer);
    registerCommand("azureStorage.editFile", async (node: IAzureNode<FileNode>) => await _editor.showEditor(node));
    registerCommand("azureStorage.deleteFileShare", async (node: IAzureParentNode<FileShareNode>) => await node.deleteNode());
    registerCommand("azureStorage.createDirectory", async (node: IAzureParentNode<FileShareNode>) => await node.createChild(DirectoryNode.contextValue));
    registerCommand("azureStorage.createTextFile", async (node: IAzureParentNode<FileShareNode>) => {
        let childNode = await node.createChild(FileNode.contextValue);
        await vscode.commands.executeCommand("azureStorage.editFile", childNode);
    });
    registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await _editor.onDidSaveTextDocument(this, doc); });
}

async function openFileShareInStorageExplorer(node: IAzureNode<FileShareNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;
    let subscriptionid = node.subscriptionId;
    const resourceType = 'Azure.FileShare';
    let resourceName = node.treeItem.share.name;

    await storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}
