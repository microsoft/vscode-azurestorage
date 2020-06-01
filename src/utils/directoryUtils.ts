/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from "@azure/storage-file-share";
import * as path from "path";
import { ProgressLocation, window } from "vscode";
import { AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from "vscode-azureextensionui";
import { maxPageSize } from "../constants";
import { ext } from "../extensionVariables";
import { DirectoryTreeItem } from "../tree/fileShare/DirectoryTreeItem";
import { IFileShareCreateChildContext } from "../tree/fileShare/FileShareTreeItem";
import { IStorageRoot } from "../tree/IStorageRoot";
import { createDirectoryClient, deleteFile } from "./fileUtils";
import { validateFileDirectoryName } from "./validateNames";

// Supports both file share and directory parents
export async function askAndCreateChildDirectory(parent: AzureParentTreeItem<IStorageRoot>, parentPath: string, shareName: string, context: ICreateChildImplContext & IFileShareCreateChildContext): Promise<DirectoryTreeItem> {
    const dirName = context.childName || await window.showInputBox({
        placeHolder: 'Enter a name for the new directory',
        validateInput: validateFileDirectoryName
    });

    if (dirName) {
        return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(dirName);
            progress.report({ message: `Azure Storage: Creating directory '${path.posix.join(parentPath, dirName)}'` });
            const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(parent.root, shareName, path.posix.join(parentPath, dirName));
            await directoryClient.create();
            return new DirectoryTreeItem(parent, parentPath, dirName, shareName);
        });
    }

    throw new UserCancelledError();
}

export async function listFilesInDirectory(directory: string, shareName: string, root: IStorageRoot, currentToken?: string): Promise<{ files: azureStorageShare.FileItem[], directories: azureStorageShare.DirectoryItem[], continuationToken: string }> {
    const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(root, shareName, directory);
    const response: AsyncIterableIterator<azureStorageShare.DirectoryListFilesAndDirectoriesSegmentResponse> = directoryClient.listFilesAndDirectories().byPage({ continuationToken: currentToken, maxPageSize });

    // tslint:disable-next-line: no-unsafe-any
    let responseValue: azureStorageShare.DirectoryListFilesAndDirectoriesSegmentResponse = (await response.next()).value;

    let files: azureStorageShare.FileItem[] = responseValue.segment.fileItems;
    let directories: azureStorageShare.DirectoryItem[] = responseValue.segment.directoryItems;
    currentToken = responseValue.continuationToken;

    return { files, directories, continuationToken: currentToken };
}

export async function deleteDirectoryAndContents(directory: string, shareName: string, root: IStorageRoot): Promise<void> {
    const parallelOperations = 5;

    let currentToken: string | undefined;
    // tslint:disable-next-line:no-constant-condition
    while (true) {
        let { files, directories, continuationToken }: { files: azureStorageShare.FileItem[], directories: azureStorageShare.DirectoryItem[], continuationToken: string } = await listFilesInDirectory(directory, shareName, root, currentToken);
        let promises: Promise<void>[] = [];
        for (let file of files) {
            let promise = deleteFile(directory, file.name, shareName, root);
            promises.push(promise);
            ext.outputChannel.appendLog(`Deleted file "${directory}/${file.name}"`);

            if (promises.length >= parallelOperations) {
                await Promise.all(promises);
                promises = [];
            }
        }
        await Promise.all(promises);

        for (let dir of directories) {
            await deleteDirectoryAndContents(path.posix.join(directory, dir.name), shareName, root);
        }

        currentToken = continuationToken;
        if (!currentToken) {
            break;
        }
    }

    const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(root, shareName, directory);
    await directoryClient.delete();
    ext.outputChannel.appendLog(`Deleted directory "${directory}"`);
}

export async function doesDirectoryExist(parent: AzureParentTreeItem<IStorageRoot>, directoryPath: string, shareName: string): Promise<boolean> {
    const directoryClient: azureStorageShare.ShareDirectoryClient = createDirectoryClient(parent.root, shareName, directoryPath);
    try {
        await directoryClient.getProperties();
        return true;
    } catch {
        return false;
    }
}
