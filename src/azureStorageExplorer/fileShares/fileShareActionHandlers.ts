/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { IActionContext, registerCommand, registerEvent } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { DirectoryTreeItem } from './directoryNode';
import { FileFileHandler } from './fileFileHandler';
import { FileTreeItem } from './fileNode';
import { FileShareTreeItem } from './fileShareNode';

export function registerFileShareActionHandlers(): void {
    const _editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt");

    ext.context.subscriptions.push(_editor);

    registerCommand("azureStorage.openFileShare", openFileShareInStorageExplorer);
    registerCommand("azureStorage.editFile", async (treeItem: FileTreeItem) => await _editor.showEditor(treeItem));
    registerCommand("azureStorage.deleteFileShare", async (treeItem: FileShareTreeItem) => await treeItem.deleteTreeItem());
    registerCommand("azureStorage.createDirectory", async (treeItem: FileShareTreeItem) => await treeItem.createChild(DirectoryTreeItem.contextValue));
    registerCommand("azureStorage.createTextFile", async (treeItem: FileShareTreeItem) => {
        let childTreeItem = await treeItem.createChild(FileTreeItem.contextValue);
        await vscode.commands.executeCommand("azureStorage.editFile", childTreeItem);
    });
    registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await _editor.onDidSaveTextDocument(this, doc); });
}

async function openFileShareInStorageExplorer(treeItem: FileShareTreeItem): Promise<void> {
    let accountId = treeItem.storageAccount.id;
    let subscriptionid = treeItem.root.subscriptionId;
    const resourceType = 'Azure.FileShare';
    let resourceName = treeItem.share.name;

    await storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}
