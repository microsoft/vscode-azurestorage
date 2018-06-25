/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from "path";

import { StorageAccount, StorageAccountKey } from "azure-arm-storage/lib/models";
import { OutputChannel, ProgressLocation, window } from "vscode";
import { IAzureTreeItem, UserCancelledError } from "vscode-azureextensionui";
import { DirectoryNode } from "./directoryNode";
import { deleteFile } from "./fileUtils";
import { validateDirectoryName } from "./validateNames";

// Supports both file share and directory parents
export async function askAndCreateChildDirectory(parentPath: string, share: azureStorage.FileService.ShareResult, storageAccount: StorageAccount, key: StorageAccountKey, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
    const dirName = await window.showInputBox({
        placeHolder: 'Enter a name for the new directory',
        validateInput: validateDirectoryName
    });

    if (dirName) {
        return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
            showCreatingNode(dirName);
            progress.report({ message: `Azure Storage: Creating directory '${path.posix.join(parentPath, dirName)}'` });
            let dir = await createDirectory(share, storageAccount, key, parentPath, dirName);

            // DirectoryResult.name contains the parent path in this call, but doesn't in other places such as listing directories.
            // Remove it here to be consistent.
            dir.name = path.basename(dir.name);

            return new DirectoryNode(parentPath, dir, share, storageAccount, key);
        });
    }

    throw new UserCancelledError();
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
function createDirectory(share: azureStorage.FileService.ShareResult, storageAccount: StorageAccount, key: StorageAccountKey, parentPath: string, name: string): Promise<azureStorage.BlobService.BlobResult> {
    return new Promise((resolve, reject) => {
        const fileService = azureStorage.createFileService(storageAccount.name, key.value);
        fileService.createDirectory(share.name, path.posix.join(parentPath, name), (err: Error, result: azureStorage.BlobService.BlobResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
export function listFilesInDirectory(directory: string, share: string, storageAccount: string, key: string, maxResults: number, currentToken?: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
    return new Promise((resolve, reject) => {
        const fileService = azureStorage.createFileService(storageAccount, key);
        fileService.listFilesAndDirectoriesSegmented(share, directory, currentToken, { maxResults: maxResults }, (err: Error, result: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

export async function deleteDirectoryAndContents(directory: string, share: string, storageAccount: string, key: string, channel: OutputChannel): Promise<void> {
    const parallelOperations = 5;
    const maxResults = 50;

    // tslint:disable-next-line:no-unnecessary-initializer
    let currentToken: azureStorage.common.ContinuationToken | undefined = undefined;
    // tslint:disable-next-line:no-constant-condition
    while (true) {
        let { entries, continuationToken } = await listFilesInDirectory(directory, share, storageAccount, key, maxResults, currentToken);
        let promises: Promise<void>[] = [];
        for (let file of entries.files) {
            let promise = deleteFile(directory, file.name, share, storageAccount, key);
            promises.push(promise);
            channel.appendLine(`Deleted file "${directory}/${file.name}"`);

            if (promises.length >= parallelOperations) {
                await Promise.all(promises);
                promises = [];
            }
        }
        await Promise.all(promises);

        for (let dir of entries.directories) {
            await deleteDirectoryAndContents(path.posix.join(directory, dir.name), share, storageAccount, key, channel);
        }

        currentToken = continuationToken;
        if (!currentToken) {
            break;
        }
    }

    await deleteDirectoryOnly(directory, share, storageAccount, key);
    channel.appendLine(`Deleted directory "${directory}"`);
}

async function deleteDirectoryOnly(directory: string, share: string, storageAccount: string, key: string): Promise<void> {
    const fileService = azureStorage.createFileService(storageAccount, key);
    await new Promise((resolve, reject) => {
        fileService.deleteDirectory(share, directory, err => {
            // tslint:disable-next-line:no-void-expression // Grandfathered in
            err ? reject(err) : resolve();
        });
    });
}
