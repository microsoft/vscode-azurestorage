/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IActionContext, registerCommand, registerEvent } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerTreeItem, ChildType } from './blobContainerNode';
import { BlobFileHandler } from './blobFileHandler';
import { BlobTreeItem } from './blobNode';

export function registerBlobContainerActionHandlers(): void {
    const _editor: RemoteFileEditor<BlobTreeItem> = new RemoteFileEditor(new BlobFileHandler(), "azureStorage.blob.showSavePrompt");
    ext.context.subscriptions.push(_editor);

    registerCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommand("azureStorage.editBlob", async (treeItem: BlobTreeItem) => await _editor.showEditor(treeItem));
    registerCommand("azureStorage.deleteBlobContainer", async (treeItem: BlobContainerTreeItem) => await treeItem.deleteTreeItem());
    registerCommand("azureStorage.createBlockTextBlob", async (treeItem: BlobContainerTreeItem) => {
        let childTreeItem = await treeItem.createChild({ childType: ChildType.newBlockBlob });
        await vscode.commands.executeCommand("azureStorage.editBlob", childTreeItem);
    });
    registerCommand("azureStorage.uploadBlockBlob", async (treeItem: BlobContainerTreeItem) => await treeItem.uploadBlockBlob());
    registerEvent('azureStorage.blobEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await _editor.onDidSaveTextDocument(this, doc); });
}

async function openBlobContainerInStorageExplorer(treeItem: BlobContainerTreeItem): Promise<void> {
    let accountId = treeItem.storageAccount.id;
    const resourceType = 'Azure.BlobContainer';
    let resourceName = treeItem.container.name;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
