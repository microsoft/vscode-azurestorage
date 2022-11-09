/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azureStorageShare from '@azure/storage-file-share';
import { DialogResponses, IActionContext, registerCommand, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { AzureStorageFS } from '../../AzureStorageFS';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { DirectoryTreeItem } from '../../tree/fileShare/DirectoryTreeItem';
import { FileShareItem } from '../../tree/fileShare/FileShareItem';
import { FileShareTreeItem, IFileShareCreateChildContext } from '../../tree/fileShare/FileShareTreeItem';
import { FileTreeItem } from '../../tree/fileShare/FileTreeItem';
import { createShareClient } from '../../utils/fileUtils';
import { registerBranchCommand } from '../../utils/v2/commandUtils';
import { pickForDeleteNode } from '../commonTreeCommands';

export function registerFileShareActionHandlers(): void {
    registerCommand("azureStorage.openFileShare", openFileShareInStorageExplorer);
    registerCommand("azureStorage.editFile", async (context: IActionContext, treeItem: FileTreeItem) => AzureStorageFS.showEditor(context, treeItem), 250);
    registerBranchCommand("azureStorage.deleteFileShare", deleteFileShare);
    registerCommand("azureStorage.createDirectory", async (context: IActionContext, treeItem: FileShareTreeItem) => await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: DirectoryTreeItem.contextValue }));
    registerCommand("azureStorage.createFile", async (context: IActionContext, treeItem: FileShareTreeItem) => {
        const childTreeItem = await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: FileTreeItem.contextValue });
        await vscode.commands.executeCommand("azureStorage.editFile", childTreeItem);
    });
}

async function openFileShareInStorageExplorer(_context: IActionContext, treeItem: FileShareTreeItem): Promise<void> {
    const accountId = treeItem.root.storageAccountId;
    const subscriptionid = treeItem.subscription.subscriptionId;
    const resourceType = 'Azure.FileShare';
    const resourceName = treeItem.shareName;

    await storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}

export async function deleteFileShare(context: IActionContext, treeItem?: FileShareItem): Promise<void> {
    treeItem = await pickForDeleteNode(context, FileShareTreeItem.contextValue, treeItem);

    const message: string = `Are you sure you want to delete file share '${treeItem.shareName}' and all its contents?`;
    const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    if (result === DialogResponses.deleteResponse) {
        const shareClient: azureStorageShare.ShareClient = createShareClient(treeItem.storageRoot, treeItem.shareName);
        await shareClient.delete();
        treeItem.notifyDeleted();
    } else {
        throw new UserCancelledError();
    }

    // Re-enable FS events.
    // AzureStorageFS.fireDeleteEvent(this);
}
