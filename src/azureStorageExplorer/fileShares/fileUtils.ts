/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { IAzureTreeItem, UserCancelledError } from "vscode-azureextensionui";
import { window, ProgressLocation } from "vscode";
import { validateFileName } from "./validateNames";
import { FileNode } from "./fileNode";
import { FileService } from "azure-storage";
import { StorageAccount, StorageAccountKey } from "azure-arm-storage/lib/models";

// Currently only supports creating block blobs
export async function askAndCreateEmptyTextFile(directoryPath: string, share: FileService.ShareResult, storageAccount: StorageAccount, key: StorageAccountKey, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
    const fileName = await window.showInputBox({
        placeHolder: 'Enter a name for the new file',
        validateInput: validateFileName
    });

    if (fileName) {
        return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
            showCreatingNode(fileName);
            progress.report({ message: `Azure Storage: Creating file '${fileName}'` });
            const file = await createFile(directoryPath, fileName, share, storageAccount, key);
            const actualFile = await getFile(directoryPath, file.name, share, storageAccount, key);
            return new FileNode(actualFile, directoryPath, share, storageAccount, key);
        });
    }

    throw new UserCancelledError();
}

function getFile(directoryPath: string, name: string, share: FileService.ShareResult, storageAccount: StorageAccount, key: StorageAccountKey): Promise<azureStorage.FileService.FileResult> {
    let fileService = azureStorage.createFileService(storageAccount.name, key.value);
    return new Promise((resolve, reject) => {
        fileService.getFileProperties(share.name, directoryPath, name, (err: Error, result: azureStorage.FileService.FileResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function createFile(directoryPath: string, name: string, share: FileService.ShareResult, storageAccount: StorageAccount, key: StorageAccountKey): Promise<azureStorage.FileService.FileResult> {
    return new Promise((resolve, reject) => {
        let fileService = azureStorage.createFileService(storageAccount.name, key.value);
        fileService.createFile(share.name, directoryPath, name, 0, (err: Error, result: azureStorage.FileService.FileResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

export async function deleteFile(directory: string, name: string, share: string, storageAccount: string, key: string): Promise<void> {
    const fileService = azureStorage.createFileService(storageAccount, key);
    await new Promise((resolve, reject) => {
        fileService.deleteFile(share, directory, name, (err) => {
            err ? reject(err) : resolve();
        });
    });
}
