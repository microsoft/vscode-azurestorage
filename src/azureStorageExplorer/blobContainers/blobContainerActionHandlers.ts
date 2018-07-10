/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { IActionContext, IAzureNode, IAzureParentNode, registerCommand, registerEvent } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerNode, ChildType } from './blobContainerNode';
import { BlobFileHandler } from './blobFileHandler';
import { BlobNode } from './blobNode';

export function registerBlobContainerActionHandlers(): void {
    const _editor: RemoteFileEditor<IAzureNode<BlobNode>> = new RemoteFileEditor(new BlobFileHandler(), "azureStorage.blob.showSavePrompt");
    ext.context.subscriptions.push(_editor);

    registerCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommand("azureStorage.editBlob", async (node: IAzureParentNode<BlobNode>) => await _editor.showEditor(node));
    registerCommand("azureStorage.deleteBlobContainer", async (node: IAzureParentNode<BlobContainerNode>) => await node.deleteNode());
    registerCommand("azureStorage.createBlockTextBlob", async (node: IAzureParentNode<BlobContainerNode>) => {
        let childNode = await node.createChild({ childType: ChildType.newBlockBlob });
        await vscode.commands.executeCommand("azureStorage.editBlob", childNode);
    });
    registerCommand("azureStorage.uploadBlockBlob", async (node: IAzureParentNode<BlobContainerNode>) => await node.treeItem.uploadBlockBlob(node));
    registerEvent('azureStorage.blobEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await _editor.onDidSaveTextDocument(this, doc); });
}

async function openBlobContainerInStorageExplorer(node: IAzureNode<BlobContainerNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;
    const resourceType = 'Azure.BlobContainer';
    let resourceName = node.treeItem.container.name;

    await storageExplorerLauncher.openResource(accountId, node.subscriptionId, resourceType, resourceName);
}
