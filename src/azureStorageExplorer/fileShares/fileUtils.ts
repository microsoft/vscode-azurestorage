/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { FileService } from "azure-storage";
import { ProgressLocation, window } from "vscode";
import { AzureParentTreeItem, AzureTreeItem, UserCancelledError } from "vscode-azureextensionui";
import { StorageAccountKeyWrapper, StorageAccountWrapper } from "../../components/storageWrappers";
import { FileTreeItem } from "./fileNode";
import { validateFileName } from "./validateNames";

// Currently only supports creating block blobs
export async function askAndCreateEmptyTextFile(parent: AzureParentTreeItem, directoryPath: string, share: FileService.ShareResult, storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper, showCreatingTreeItem: (label: string) => void): Promise<AzureTreeItem> {
    const fileName = await window.showInputBox({
        placeHolder: 'Enter a name for the new file',
        validateInput: validateFileName
    });

    if (fileName) {
        return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
            showCreatingTreeItem(fileName);
            progress.report({ message: `Azure Storage: Creating file '${fileName}'` });
            const file = await createFile(directoryPath, fileName, share, storageAccount, key);
            const actualFile = await getFile(directoryPath, file.name, share, storageAccount, key);
            return new FileTreeItem(parent, actualFile, directoryPath, share, storageAccount, key);
        });
    }

    throw new UserCancelledError();
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
function getFile(directoryPath: string, name: string, share: FileService.ShareResult, storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): Promise<azureStorage.FileService.FileResult> {
    let fileService = azureStorage.createFileService(storageAccount.name, key.value);
    return new Promise((resolve, reject) => {
        fileService.getFileProperties(share.name, directoryPath, name, (err?: Error, result?: azureStorage.FileService.FileResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
function createFile(directoryPath: string, name: string, share: FileService.ShareResult, storageAccount: StorageAccountWrapper, key: StorageAccountKeyWrapper): Promise<azureStorage.FileService.FileResult> {
    return new Promise((resolve, reject) => {
        let fileService = azureStorage.createFileService(storageAccount.name, key.value);
        fileService.createFile(share.name, directoryPath, name, 0, (err?: Error, result?: azureStorage.FileService.FileResult) => {
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
        // tslint:disable-next-line:no-any
        fileService.deleteFile(share, directory, name, (err?: any) => {
            // tslint:disable-next-line:no-void-expression // Grandfathered in
            err ? reject(err) : resolve();
        });
    });
}
