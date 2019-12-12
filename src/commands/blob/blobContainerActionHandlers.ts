/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext, registerCommand, registerEvent } from 'vscode-azureextensionui';
import { BlobFileHandler } from '../../editors/BlobFileHandler';
import { RemoteFileEditor } from '../../editors/RemoteFileEditor';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { BlobTreeItem } from '../../tree/blob/BlobTreeItem';
import { deleteNode } from '../commonTreeCommands';

export function registerBlobContainerActionHandlers(): void {
    const _editor: RemoteFileEditor<BlobTreeItem> = new RemoteFileEditor(new BlobFileHandler(), "azureStorage.blob.showSavePrompt");
    ext.context.subscriptions.push(_editor);

    registerCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommand("azureStorage.editBlob", async (_context: IActionContext, treeItem: BlobTreeItem) => await _editor.showEditor(treeItem));
    registerCommand("azureStorage.deleteBlobContainer", async (context: IActionContext, treeItem?: BlobContainerTreeItem) => await deleteNode(context, BlobContainerTreeItem.contextValue, treeItem));
    registerCommand("azureStorage.createBlockTextBlob", async (context: IActionContext, treeItem: BlobContainerTreeItem) => {
        let childTreeItem = await treeItem.createChild(context);
        await vscode.commands.executeCommand("azureStorage.editBlob", childTreeItem);
    });
    registerCommand("azureStorage.uploadBlockBlob", async (context: IActionContext, treeItem: BlobContainerTreeItem) => await treeItem.uploadBlockBlob(context));
    registerEvent('azureStorage.blobEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async (context: IActionContext, doc: vscode.TextDocument) => { await _editor.onDidSaveTextDocument(context, doc); });
}

async function openBlobContainerInStorageExplorer(_context: IActionContext, treeItem: BlobContainerTreeItem): Promise<void> {
    let accountId = treeItem.root.storageAccount.id;
    const resourceType = 'Azure.BlobContainer';
    let resourceName = treeItem.container.name;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
