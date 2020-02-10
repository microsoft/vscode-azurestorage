/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { AzureStorageFS } from '../../AzureStorageFS';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { BlobTreeItem } from '../../tree/blob/BlobTreeItem';
import { showBlobPathInputBox } from '../../utils/blobUtils';
import { deleteNode } from '../commonTreeCommands';

export function registerBlobContainerActionHandlers(): void {
    registerCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommand("azureStorage.editBlob", async (_context: IActionContext, treeItem: BlobTreeItem) => AzureStorageFS.showEditor(treeItem), 250);
    registerCommand("azureStorage.deleteBlobContainer", async (context: IActionContext, treeItem?: BlobContainerTreeItem) => await deleteNode(context, BlobContainerTreeItem.contextValue, treeItem));
    registerCommand("azureStorage.createBlockBlob", async (context: IActionContext, parent: BlobContainerTreeItem) => {
        const blobPath: string = await showBlobPathInputBox(parent);
        const dirNames: string[] = blobPath.split('/').slice(0, -1);
        let currentPath: string = '';

        for (const dirName of dirNames) {
            currentPath += `${dirName}/`;
            const dirUri: vscode.Uri = AzureStorageFS.idToUri(parent.fullId, currentPath);

            try {
                let fileType: vscode.FileType = (await ext.azureStorageFS.stat(dirUri)).type;
                if (fileType !== vscode.FileType.Directory) {
                    // Remove trailing slash from currentPath for error message
                    throw new Error(`${currentPath.slice(0, -1)} is not a directory`);
                }
            } catch (err) {
                if (err instanceof vscode.FileSystemError) {
                    // This directory doesn't exist yet
                    await ext.azureStorageFS.createDirectory(dirUri);
                } else {
                    throw err;
                }
            }
        }

        const childUri: vscode.Uri = AzureStorageFS.idToUri(parent.fullId, blobPath);
        await ext.azureStorageFS.writeFile(childUri, new Uint8Array(0), { create: true, overwrite: false });

        const childTreeItem: BlobTreeItem = <BlobTreeItem>(await ext.azureStorageFS.lookup(childUri, context));
        await vscode.commands.executeCommand("azureStorage.editBlob", childTreeItem);
    });
    registerCommand("azureStorage.uploadBlockBlob", async (context: IActionContext, treeItem: BlobContainerTreeItem) => await treeItem.uploadBlockBlob(context));
}

async function openBlobContainerInStorageExplorer(_context: IActionContext, treeItem: BlobContainerTreeItem): Promise<void> {
    let accountId = treeItem.root.storageAccount.id;
    const resourceType = 'Azure.BlobContainer';
    let resourceName = treeItem.container.name;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
