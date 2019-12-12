/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { IActionContext, registerCommand, registerEvent } from 'vscode-azureextensionui';
import { FileFileHandler } from '../../editors/FileFileHandler';
import { RemoteFileEditor } from '../../editors/RemoteFileEditor';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { DirectoryTreeItem } from '../../tree/fileShare/DirectoryTreeItem';
import { FileShareTreeItem, IFileShareCreateChildContext } from '../../tree/fileShare/FileShareTreeItem';
import { FileTreeItem } from '../../tree/fileShare/FileTreeItem';
import { deleteNode } from '../commonTreeCommands';

export function registerFileShareActionHandlers(): void {
    const _editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt");

    ext.context.subscriptions.push(_editor);

    registerCommand("azureStorage.openFileShare", openFileShareInStorageExplorer);
    registerCommand("azureStorage.editFile", async (_context: IActionContext, treeItem: FileTreeItem) => await _editor.showEditor(treeItem));
    registerCommand("azureStorage.deleteFileShare", async (context: IActionContext, treeItem?: FileShareTreeItem) => await deleteNode(context, FileShareTreeItem.contextValue, treeItem));
    registerCommand("azureStorage.createDirectory", async (context: IActionContext, treeItem: FileShareTreeItem) => await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: DirectoryTreeItem.contextValue }));
    registerCommand("azureStorage.createTextFile", async (context: IActionContext, treeItem: FileShareTreeItem) => {
        let childTreeItem = await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: FileTreeItem.contextValue });
        await vscode.commands.executeCommand("azureStorage.editFile", childTreeItem);
    });
    registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async (context: IActionContext, doc: vscode.TextDocument) => { await _editor.onDidSaveTextDocument(context, doc); });
}

async function openFileShareInStorageExplorer(_context: IActionContext, treeItem: FileShareTreeItem): Promise<void> {
    let accountId = treeItem.root.storageAccount.id;
    let subscriptionid = treeItem.root.subscriptionId;
    const resourceType = 'Azure.FileShare';
    let resourceName = treeItem.share.name;

    await storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}
