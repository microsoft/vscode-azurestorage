/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { BlobContainerNode, ChildType } from './blobContainerNode';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler, IAzureParentNode, IActionContext } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { azureStorageOutputChannel } from '../azureStorageOutputChannel';
import { BlobNode } from './blobNode';
import { BlobFileHandler } from './blobFileHandler';

export function registerBlobContainerActionHandlers(actionHandler: AzureActionHandler, context: vscode.ExtensionContext): void {
    const _editor: RemoteFileEditor<IAzureNode<BlobNode>> = new RemoteFileEditor(new BlobFileHandler(), "azureStorage.blob.showSavePrompt", azureStorageOutputChannel);
    context.subscriptions.push(_editor);

    actionHandler.registerCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    actionHandler.registerCommand("azureStorage.editBlob", async (node: IAzureParentNode<BlobNode>) => await _editor.showEditor(node));
    actionHandler.registerCommand("azureStorage.deleteBlobContainer", async (node: IAzureParentNode<BlobContainerNode>) => await node.deleteNode());
    actionHandler.registerCommand("azureStorage.createBlockTextBlob", async (node: IAzureParentNode<BlobContainerNode>) => {
        let childNode = await node.createChild({ childType: ChildType.newBlockBlob });
        await vscode.commands.executeCommand("azureStorage.editBlob", childNode);
    });
    actionHandler.registerCommand("azureStorage.uploadBlockBlob", async (node: IAzureParentNode<BlobContainerNode>) => await node.treeItem.uploadBlockBlob(node, azureStorageOutputChannel));
    actionHandler.registerEvent('azureStorage.blobEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, async function (this: IActionContext, doc: vscode.TextDocument): Promise<void> { await _editor.onDidSaveTextDocument(this, doc); });
}

async function openBlobContainerInStorageExplorer(node: IAzureNode<BlobContainerNode>): Promise<void> {
    let accountId = node.treeItem.storageAccount.id;
    const resourceType = 'Azure.BlobContainer';
    let resourceName = node.treeItem.container.name;

    await storageExplorerLauncher.openResource(accountId, node.subscriptionId, resourceType, resourceName);
}
