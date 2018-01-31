/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from "path";

import { IAzureTreeItem, UserCancelledError } from "vscode-azureextensionui";
import { window, ProgressLocation } from "vscode";
import { DirectoryNode } from "./directoryNode";
import { StorageAccount, StorageAccountKey } from "azure-arm-storage/lib/models";
import { validateDirectoryName } from "./validateNames";

// Supports both file share and directory parents
export async function askAndCreateChildDirectory(share: azureStorage.FileService.ShareResult, parentPath: string, storageAccount: StorageAccount, key: StorageAccountKey, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
    const dirName = await window.showInputBox({
        placeHolder: `Enter a name for the new directory`,
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

function createDirectory(share: azureStorage.FileService.ShareResult, storageAccount: StorageAccount, key: StorageAccountKey, parentPath: string, name: string): Promise<azureStorage.BlobService.BlobResult> {
    return new Promise((resolve, reject) => {
        var fileService = azureStorage.createFileService(storageAccount.name, key.value);
        fileService.createDirectory(share.name, path.posix.join(parentPath, name), (err: Error, result: azureStorage.BlobService.BlobResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}
