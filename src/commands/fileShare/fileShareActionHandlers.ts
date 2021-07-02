/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { IActionContext, registerCommand } from 'vscode-azureextensionui';
import { AzureStorageFS } from '../../AzureStorageFS';
import { storageExplorerLauncher } from '../../storageExplorerLauncher/storageExplorerLauncher';
import { DirectoryTreeItem } from '../../tree/fileShare/DirectoryTreeItem';
import { FileShareTreeItem, IFileShareCreateChildContext } from '../../tree/fileShare/FileShareTreeItem';
import { FileTreeItem } from '../../tree/fileShare/FileTreeItem';
import { deleteNode } from '../commonTreeCommands';

export function registerFileShareActionHandlers(): void {
    registerCommand("azureStorage.openFileShare", openFileShareInStorageExplorer);
    registerCommand("azureStorage.editFile", async (context: IActionContext, treeItem: FileTreeItem) => AzureStorageFS.showEditor(context, treeItem), 250);
    registerCommand("azureStorage.deleteFileShare", deleteFileShare);
    registerCommand("azureStorage.createDirectory", async (context: IActionContext, treeItem: FileShareTreeItem) => await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: DirectoryTreeItem.contextValue }));
    registerCommand("azureStorage.createFile", async (context: IActionContext, treeItem: FileShareTreeItem) => {
        const childTreeItem = await treeItem.createChild(<IFileShareCreateChildContext>{ ...context, childType: FileTreeItem.contextValue });
        await vscode.commands.executeCommand("azureStorage.editFile", childTreeItem);
    });
}

async function openFileShareInStorageExplorer(_context: IActionContext, treeItem: FileShareTreeItem): Promise<void> {
    const accountId = treeItem.root.storageAccountId;
    const subscriptionid = treeItem.root.subscriptionId;
    const resourceType = 'Azure.FileShare';
    const resourceName = treeItem.shareName;

    await storageExplorerLauncher.openResource(accountId, subscriptionid, resourceType, resourceName);
}

export async function deleteFileShare(context: IActionContext, treeItem?: FileShareTreeItem): Promise<void> {
    await deleteNode(context, FileShareTreeItem.contextValue, treeItem);
}
