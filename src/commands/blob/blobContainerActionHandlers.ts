/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { AzureStorageFS } from '../../AzureStorageFS';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { BlobDirectoryTreeItem } from '../../tree/blob/BlobDirectoryTreeItem';
import { BlobTreeItem } from '../../tree/blob/BlobTreeItem';
import { IBlobContainerCreateChildContext, showBlobPathInputBox } from '../../utils/blobUtils';
import { localize } from '../../utils/localize';
import { deleteNode } from '../commonTreeCommands';

export function registerBlobContainerActionHandlers(): void {
    registerCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommand("azureStorage.editBlob", async (_context: IActionContext, treeItem: BlobTreeItem) => AzureStorageFS.showEditor(treeItem), 250);
    registerCommand("azureStorage.deleteBlobContainer", async (context: IActionContext, treeItem?: BlobContainerTreeItem) => await deleteNode(context, BlobContainerTreeItem.contextValue, treeItem));
    registerCommand("azureStorage.createBlockBlob", async (context: IActionContext, parent: BlobContainerTreeItem) => {
        const blobPath: string = await showBlobPathInputBox(parent);
        const dirNames: string[] = blobPath.includes('/') ? path.dirname(blobPath).split('/') : [];
        let currentDirId: string = parent.fullId;
        let currentDirPath: string = '';

        for (const dirName of dirNames) {
            currentDirPath += dirName;
            currentDirId = `${parent.fullId}/${currentDirPath}`;

            let treeItem: BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem | undefined = await ext.tree.findTreeItem(currentDirId, context);
            if (!treeItem) {
                // This directory doesn't exist yet
                const dirParentPath: string = currentDirPath.includes('/') ? `/${path.dirname(currentDirPath)}` : '';
                const dirParentId: string = `${parent.fullId}${dirParentPath}`;
                const dirParentTreeItem: BlobDirectoryTreeItem | BlobContainerTreeItem = <BlobDirectoryTreeItem | BlobContainerTreeItem>await ext.tree.findTreeItem(dirParentId, context);
                await dirParentTreeItem.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: BlobDirectoryTreeItem.contextValue, childName: dirName });
            } else {
                const fileType: vscode.FileType = treeItem instanceof BlobDirectoryTreeItem || treeItem instanceof BlobContainerTreeItem ? vscode.FileType.Directory : vscode.FileType.File;
                if (fileType !== vscode.FileType.Directory) {
                    throw new Error(localize('resourceIsNotADirectory', `"${currentDirPath}" is not a directory`));
                }
            }

            currentDirPath += '/';
        }

        const blobParent: BlobDirectoryTreeItem | BlobContainerTreeItem = <BlobDirectoryTreeItem | BlobContainerTreeItem>await ext.tree.findTreeItem(currentDirId, context);
        const childTreeItem: BlobTreeItem = <BlobTreeItem>await blobParent.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: BlobTreeItem.contextValue, childName: blobPath });
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
