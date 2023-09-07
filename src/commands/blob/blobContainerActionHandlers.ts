/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommandWithTreeNodeUnwrapping } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import * as vscode from 'vscode';
import { AzureStorageFS } from '../../AzureStorageFS';
import { BlobContainerFS } from '../../BlobContainerFS';
import { ext } from '../../extensionVariables';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { BlobDirectoryTreeItem } from '../../tree/blob/BlobDirectoryTreeItem';
import { BlobTreeItem } from '../../tree/blob/BlobTreeItem';
import { getBlobPath, IBlobContainerCreateChildContext } from '../../utils/blobUtils';
import { localize } from '../../utils/localize';
import { deleteNode } from '../commonTreeCommands';

export function registerBlobContainerActionHandlers(): void {
    registerCommandWithTreeNodeUnwrapping("azureStorage.openBlobContainer", openBlobContainerInStorageExplorer);
    registerCommandWithTreeNodeUnwrapping("azureStorage.editBlob", async (context: IActionContext, treeItem: BlobTreeItem) => {
        if (!AzureStorageFS.isAttachedAccount(treeItem)) {
            return BlobContainerFS.showEditor(context, treeItem);
        } else {
            return AzureStorageFS.showEditor(context, treeItem);
        }
    }, 250);
    registerCommandWithTreeNodeUnwrapping("azureStorage.deleteBlobContainer", deleteBlobContainer);
    registerCommandWithTreeNodeUnwrapping("azureStorage.createBlockBlob", async (context: IActionContext, parent: BlobContainerTreeItem) => {
        const blobPath: string = normalizeBlobPathInput(await getBlobPath(context, parent));
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

async function openBlobContainerInStorageExplorer(_context: IActionContext, treeItem: BlobContainerTreeItem): Promise<void> {
    const accountId = treeItem.root.storageAccountId;
    const resourceType = 'Azure.BlobContainer';
    const resourceName = treeItem.container.name;

    await storageExplorerLauncher.openResource(accountId, treeItem.subscription.subscriptionId, resourceType, resourceName);
}

export async function deleteBlobContainer(context: IActionContext, treeItem?: BlobContainerTreeItem): Promise<void> {
    await deleteNode(context, BlobContainerTreeItem.contextValue, treeItem);
}

/**
 * Normalize and remove leading slash from path if present
 */
function normalizeBlobPathInput(blobPath: string): string {
    return path.posix.normalize(blobPath).replace(/^\/|\/$/g, '');
}
