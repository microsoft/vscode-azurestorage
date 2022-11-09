/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import { DialogResponses, IActionContext, registerCommand } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureStorageFS } from '../../AzureStorageFS';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerItem } from '../../tree/blob/BlobContainerItem';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { BlobDirectoryTreeItem } from '../../tree/blob/BlobDirectoryTreeItem';
import { BlobTreeItem } from '../../tree/blob/BlobTreeItem';
import { createBlobContainerClient, getBlobPath, IBlobContainerCreateChildContext } from '../../utils/blobUtils';
import { localize } from '../../utils/localize';
import { registerBranchCommand } from '../../utils/v2/commandUtils';
import { pickForDeleteNode } from '../commonTreeCommands';

export function registerBlobContainerActionHandlers(): void {
    registerBranchCommand("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommand("azureStorage.editBlob", async (context: IActionContext, treeItem: BlobTreeItem) => AzureStorageFS.showEditor(context, treeItem), 250);
    registerBranchCommand("azureStorage.deleteBlobContainer", deleteBlobContainer);
    registerCommand("azureStorage.createBlockBlob", async (context: IActionContext, parent: BlobContainerTreeItem) => {
        const blobPath: string = await getBlobPath(context, parent.root, parent.container.name);
        const dirNames: string[] = blobPath.includes('/') ? path.dirname(blobPath).split('/') : [];
        let dirParentTreeItem: BlobDirectoryTreeItem | BlobContainerTreeItem = parent;

        for (const dirName of dirNames) {
            const treeItem: BlobTreeItem | BlobDirectoryTreeItem | BlobContainerTreeItem | undefined = await ext.rgApi.appResourceTree.findTreeItem(`${dirParentTreeItem.fullId}/${dirName}`, context);
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

async function openBlobContainerInStorageExplorer(_context: IActionContext, treeItem: BlobContainerItem): Promise<void> {
    const accountId = treeItem.context.storageAccountId;
    const resourceType = 'Azure.BlobContainer';
    const resourceName = treeItem.containerName;

    await storageExplorerLauncher.openResource(accountId, treeItem.context.subscriptionId, resourceType, resourceName);
}

export async function deleteBlobContainer(context: IActionContext, treeItem?: BlobContainerItem): Promise<void> {
    treeItem = await pickForDeleteNode(context, BlobContainerTreeItem.contextValue, treeItem);

    const message: string = `Are you sure you want to delete blob container '${treeItem.containerName}' and all its contents?`;
    const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    if (result === DialogResponses.deleteResponse) {
        const containerClient: azureStorageBlob.ContainerClient = createBlobContainerClient(treeItem.storageRoot, treeItem.containerName);
        await containerClient.delete();
        treeItem.onDeleted();
    }

    // TODO: Reenable events on FS.
    // AzureStorageFS.fireDeleteEvent(this);
}
