/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from "path";
import { ProgressLocation, window } from "vscode";
import { AzureParentTreeItem, ICreateChildImplContext, UserCancelledError } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { IStorageRoot } from "../IStorageRoot";
import { DirectoryTreeItem } from "./directoryNode";
import { deleteFile } from "./fileUtils";
import { validateDirectoryName } from "./validateNames";

// Supports both file share and directory parents
export async function askAndCreateChildDirectory(parent: AzureParentTreeItem<IStorageRoot>, parentPath: string, share: azureStorage.FileService.ShareResult, context: ICreateChildImplContext): Promise<DirectoryTreeItem> {
    const dirName = await window.showInputBox({
        placeHolder: 'Enter a name for the new directory',
        validateInput: validateDirectoryName
    });

    if (dirName) {
        return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(dirName);
            progress.report({ message: `Azure Storage: Creating directory '${path.posix.join(parentPath, dirName)}'` });
            let dir = await createDirectory(share, parent.root, parentPath, dirName);

            // DirectoryResult.name contains the parent path in this call, but doesn't in other places such as listing directories.
            // Remove it here to be consistent.
            dir.name = path.basename(dir.name);

            return new DirectoryTreeItem(parent, parentPath, dir, share);
        });
    }

    throw new UserCancelledError();
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
export function createDirectory(share: azureStorage.FileService.ShareResult, root: IStorageRoot, parentPath: string, name: string): Promise<azureStorage.BlobService.BlobResult> {
    return new Promise((resolve, reject) => {
        const fileService = root.createFileService();
        fileService.createDirectory(share.name, path.posix.join(parentPath, name), (err: Error, result: azureStorage.BlobService.BlobResult) => {
            // tslint:disable-next-line:strict-boolean-expressions // SDK is not strict-null-checking enabled, can't type err as optional
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// tslint:disable-next-line:promise-function-async // Grandfathered in
export function listFilesInDirectory(directory: string, share: string, root: IStorageRoot, maxResults: number, currentToken?: azureStorage.common.ContinuationToken): Promise<azureStorage.FileService.ListFilesAndDirectoriesResult> {
    return new Promise((resolve, reject) => {
        const fileService = root.createFileService();
        // currentToken argument typed incorrectly in SDK
        fileService.listFilesAndDirectoriesSegmented(share, directory, <azureStorage.common.ContinuationToken>currentToken, { maxResults: maxResults }, (err?: Error, result?: azureStorage.FileService.ListFilesAndDirectoriesResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

export async function deleteDirectoryAndContents(directory: string, share: string, root: IStorageRoot): Promise<void> {
    const parallelOperations = 5;
    const maxResults = 50;

    // tslint:disable-next-line:no-unnecessary-initializer
    let currentToken: azureStorage.common.ContinuationToken | undefined = undefined;
    // tslint:disable-next-line:no-constant-condition
    while (true) {
        let { entries, continuationToken }: azureStorage.FileService.ListFilesAndDirectoriesResult = await listFilesInDirectory(directory, share, root, maxResults, currentToken);
        let promises: Promise<void>[] = [];
        for (let file of entries.files) {
            let promise = deleteFile(directory, file.name, share, root);
            promises.push(promise);
            ext.outputChannel.appendLine(`Deleted file "${directory}/${file.name}"`);

            if (promises.length >= parallelOperations) {
                await Promise.all(promises);
                promises = [];
            }
        }
        await Promise.all(promises);

        for (let dir of entries.directories) {
            await deleteDirectoryAndContents(path.posix.join(directory, dir.name), share, root);
        }

        currentToken = continuationToken;
        if (!currentToken) {
            break;
        }
    }

    await deleteDirectoryOnly(directory, share, root);
    ext.outputChannel.appendLine(`Deleted directory "${directory}"`);
}

async function deleteDirectoryOnly(directory: string, share: string, root: IStorageRoot): Promise<void> {
    const fileService = root.createFileService();
    await new Promise((resolve, reject) => {
        // tslint:disable-next-line:no-any
        fileService.deleteDirectory(share, directory, (err?: any) => {
            // tslint:disable-next-line:no-void-expression // Grandfathered in
            err ? reject(err) : resolve();
        });
    });
}
