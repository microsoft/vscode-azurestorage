/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { BlobContainerNode } from './blobContainerNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { AzureStorageOutputChannel } from '../azureStorageOutputChannel';
import { BlobNode } from './blobNode';
import { BlobFileHandler } from './blobFileHandler';

export function RegisterBlobContainerActionHandlers(actionHandler: AzureActionHandler, context: vscode.ExtensionContext) {
    const _editor: RemoteFileEditor<IAzureNode<BlobNode>> = new RemoteFileEditor(new BlobFileHandler(), "azureStorage.blob.showSavePrompt", AzureStorageOutputChannel);
    context.subscriptions.push(_editor);

    actionHandler.registerCommand("azureStorage.openBlobContainer", (node) => { openBlobContainerInStorageExplorer(node) });
    actionHandler.registerCommand("azureStorage.editBlob", (node) => { _editor.showEditor(node) });
    actionHandler.registerCommand("azureStorage.deleteBlobContainer", (node) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.createBlockTextBlob", (node) => node.createChild());
    actionHandler.registerEvent('azureStorage.blobEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, (trackTelemetry: () => void, doc: vscode.TextDocument) => _editor.onDidSaveTextDocument(trackTelemetry, doc));
}

function openBlobContainerInStorageExplorer(node: IAzureNode<BlobContainerNode>) {
    var resourceId = node.treeItem.storageAccount.id;
    var subscriptionid = node.subscription.subscriptionId;
    var resourceType = "Azure.BlobContainer";
    var resourceName = node.treeItem.container.name;

    StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
}
