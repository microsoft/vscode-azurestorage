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
import { getBlobPath, IBlobContainerCreateChildContext } from '../../utils/blobUtils';
import { localize } from '../../utils/localize';
import { deleteNode } from '../commonTreeCommands';

export function registerBlobContainerActionHandlers(): void {
    registerCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommand("azureStorage.editBlob", async (_context: IActionContext, treeItem: BlobTreeItem) => AzureStorageFS.showEditor(treeItem), 250);
    registerCommand("azureStorage.deleteBlobContainer", async (context: IActionContext, treeItem?: BlobContainerTreeItem) => await deleteNode(context, BlobContainerTreeItem.contextValue, treeItem));
    registerCommand("azureStorage.createBlockBlob", async (context: IActionContext, parent: BlobContainerTreeItem) => {
        const blobPath: string = await getBlobPath(parent);
        const dirNames: string[] = blobPath.includes('/') ? path.dirname(blobPath).split('/') : [];
        let dirParentTreeItem: BlobDirectoryTreeItem | BlobContainerTreeItem = parent;

        for (const dirName of dirNames) {
            let treeItem: BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem | undefined = await ext.tree.findTreeItem(`${dirParentTreeItem.fullId}/${dirName}`, context);
            if (!treeItem) {
                // This directory doesn't exist yet
                dirParentTreeItem = await dirParentTreeItem.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: BlobDirectoryTreeItem.contextValue, childName: dirName });
            } else {
                if (treeItem instanceof BlobTreeItem) {
                    throw new Error(localize('resourceIsNotADirectory', `"${treeItem.blobPath}" is not a directory`));
                }

                dirParentTreeItem = treeItem;
            }
        }

        const childTreeItem: BlobTreeItem = <BlobTreeItem>await dirParentTreeItem.createChild(<IBlobContainerCreateChildContext>{ ...context, childType: BlobTreeItem.contextValue, childName: blobPath });
        await vscode.commands.executeCommand("azureStorage.editBlob", childTreeItem);
    });
}

async function openBlobContainerInStorageExplorer(_context: IActionContext, treeItem: BlobContainerTreeItem): Promise<void> {
    let accountId = treeItem.root.storageAccountId;
    const resourceType = 'Azure.BlobContainer';
    let resourceName = treeItem.container.name;

    await storageExplorerLauncher.openResource(accountId, treeItem.root.subscriptionId, resourceType, resourceName);
}
