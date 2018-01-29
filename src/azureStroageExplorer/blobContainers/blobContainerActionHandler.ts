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

export class BlobContainerActionHandler extends AzureActionHandler {
    private _editor: RemoteFileEditor<IAzureNode<BlobNode>>;

    registerActions(context: vscode.ExtensionContext) {
        this._editor = new RemoteFileEditor(new BlobFileHandler(), "azureStorage.blob.showSavePrompt", AzureStorageOutputChannel);
        context.subscriptions.push(this._editor);

        this.registerCommand("azureStorage.openBlobContainer", (node) => { this.openBlobContainerInStorageExplorer(node) });
        this.registerCommand("azureStorage.editBlob", (node) => { this._editor.showEditor(node) });
        this.registerCommand("azureStorage.deleteBlobContainer", (node) => node.deleteNode());
        this.registerEvent('azureStorage.blobEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, (trackTelemetry: () => void, doc: vscode.TextDocument) => this._editor.onDidSaveTextDocument(trackTelemetry, doc));
    }

    openBlobContainerInStorageExplorer(node: IAzureNode<BlobContainerNode>) {
        var resourceId = node.treeItem.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        var resourceType = "Azure.BlobContainer";
        var resourceName = node.treeItem.container.name;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
    }
}
