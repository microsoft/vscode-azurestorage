/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { DirectoryItem, DirectoryListFilesAndDirectoriesSegmentResponse, FileItem, ShareDirectoryClient } from "@azure/storage-file-share";

import { AzExtTreeItem, ICreateChildImplContext } from "@microsoft/vscode-azext-utils";
import * as path from "path";
import { ProgressLocation, window } from "vscode";
import { maxPageSize } from "../constants";
import { ext } from "../extensionVariables";
import { IStorageRoot } from "../tree/IStorageRoot";
import { DirectoryTreeItem } from "../tree/fileShare/DirectoryTreeItem";
import { FileShareTreeItem, IFileShareCreateChildContext } from "../tree/fileShare/FileShareTreeItem";
import { createDirectoryClient, deleteFile, getFileOrDirectoryName } from "./fileUtils";

// Supports both file share and directory parents
export async function askAndCreateChildDirectory(parent: FileShareTreeItem | DirectoryTreeItem, parentPath: string, shareName: string, context: ICreateChildImplContext & IFileShareCreateChildContext): Promise<DirectoryTreeItem> {
    const dirName: string = context.childName || await getFileOrDirectoryName(context, parent, parentPath, shareName);
    return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
        context.showCreatingTreeItem(dirName);
        progress.report({ message: `Azure Storage: Creating directory '${path.posix.join(parentPath, dirName)}'` });
        const directoryClient: ShareDirectoryClient = createDirectoryClient(parent.root, shareName, path.posix.join(parentPath, dirName));
        await directoryClient.create();
        return new DirectoryTreeItem(parent, parentPath, dirName, shareName);
    });
}

export async function listFilesInDirectory(directory: string, shareName: string, root: IStorageRoot, currentToken?: string): Promise<{ files: FileItem[], directories: DirectoryItem[], continuationToken: string }> {
    const directoryClient: ShareDirectoryClient = createDirectoryClient(root, shareName, directory);
    const response: AsyncIterableIterator<DirectoryListFilesAndDirectoriesSegmentResponse> = directoryClient.listFilesAndDirectories().byPage({ continuationToken: currentToken, maxPageSize });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const responseValue: DirectoryListFilesAndDirectoriesSegmentResponse = (await response.next()).value;

    const files: FileItem[] = responseValue.segment.fileItems;
    const directories: DirectoryItem[] = responseValue.segment.directoryItems;
    currentToken = responseValue.continuationToken;

    return { files, directories, continuationToken: currentToken };
}

export async function deleteDirectoryAndContents(directory: string, shareName: string, root: IStorageRoot): Promise<void> {
    const parallelOperations = 5;

    let currentToken: string | undefined;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { files, directories, continuationToken }: { files: FileItem[], directories: DirectoryItem[], continuationToken: string } = await listFilesInDirectory(directory, shareName, root, currentToken);
        let promises: Promise<void>[] = [];
        for (const file of files) {
            const promise = deleteFile(directory, file.name, shareName, root);
            promises.push(promise);
            ext.outputChannel.appendLog(`Deleted file "${directory}/${file.name}"`);

            if (promises.length >= parallelOperations) {
                await Promise.all(promises);
                promises = [];
            }
        }
        await Promise.all(promises);

        for (const dir of directories) {
            await deleteDirectoryAndContents(path.posix.join(directory, dir.name), shareName, root);
        }

        currentToken = continuationToken;
        if (!currentToken) {
            break;
        }
    }

    const directoryClient: ShareDirectoryClient = createDirectoryClient(root, shareName, directory);
    await directoryClient.delete();
    ext.outputChannel.appendLog(`Deleted directory "${directory}"`);
}

export async function doesDirectoryExist(parent: FileShareTreeItem | DirectoryTreeItem, directoryPath: string, shareName: string): Promise<boolean> {
    const directoryClient: ShareDirectoryClient = createDirectoryClient(parent.root, shareName, directoryPath);
    try {
        await directoryClient.getProperties();
        return true;
    } catch {
        return false;
    }
}

export function isTreeItemDirectory(node: AzExtTreeItem): boolean {
    return /directory/i.test(node.contextValue);
}
