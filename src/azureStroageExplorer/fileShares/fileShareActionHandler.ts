/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { FileShareNode } from './fileShareNode';
import { StorageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';
import { RemoteFileEditor } from '../../azureServiceExplorer/editors/RemoteFileEditor';
import { FileFileHandler } from './fileFileHandler';
import { FileNode } from './fileNode';
import { AzureStorageOutputChannel } from '../azureStorageOutputChannel';

export class FileShareActionHandler extends AzureActionHandler {
    private _editor: RemoteFileEditor<IAzureNode<FileNode>>;

    registerActions(context: vscode.ExtensionContext) {
        this._editor = new RemoteFileEditor(new FileFileHandler(), "azureStorage.file.showSavePrompt", AzureStorageOutputChannel);
        context.subscriptions.push(this._editor);

        this.registerCommand("azureStorage.openFileShare", (node) => { this.openFileShareInStorageExplorer(node) });
        this.registerCommand("azureStorage.editFile", (node) => { this._editor.showEditor(node) });
        this.registerEvent('azureStorage.fileEditor.onDidSaveTextDocument', vscode.workspace.onDidSaveTextDocument, (trackTelemetry: () => void, doc: vscode.TextDocument) => this._editor.onDidSaveTextDocument(trackTelemetry, doc));
    }

    openFileShareInStorageExplorer(node: IAzureNode<FileShareNode>) {
        var resourceId = node.treeItem.storageAccount.id;
        var subscriptionid = node.subscription.subscriptionId;
        var resourceType = "Azure.FileShare";
        var resourceName = node.treeItem.share.name;

        StorageExplorerLauncher.openResource(resourceId, subscriptionid, resourceType, resourceName);
    }
}
