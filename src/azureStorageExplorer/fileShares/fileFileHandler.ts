/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';
import { FileTreeItem } from "./fileNode";

export class FileFileHandler implements IRemoteFileHandler<FileTreeItem> {
    async getSaveConfirmationText(treeItem: FileTreeItem): Promise<string> {
        return `Saving '${treeItem.file.name}' will update the file "${treeItem.file.name}" in File Share "${treeItem.share.name}"`;
    }

    async getFilename(treeItem: FileTreeItem): Promise<string> {
        return treeItem.file.name;
    }

    async downloadFile(treeItem: FileTreeItem, filePath: string): Promise<void> {
        let fileService = azureStorage.createFileService(treeItem.storageAccount.name, treeItem.key.value);
        await new Promise<void>((resolve, reject) => {
            fileService.getFileToLocalFile(treeItem.share.name, treeItem.directoryPath, treeItem.file.name, filePath, (error?: Error, _result?: azureStorage.FileService.FileResult, _response?: azureStorage.ServiceResponse) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async uploadFile(treeItem: FileTreeItem, filePath: string): Promise<void> {
        let fileService = azureStorage.createFileService(treeItem.storageAccount.name, treeItem.key.value);
        let fileProperties = await this.getProperties(treeItem);
        let createOptions: azureStorage.FileService.CreateFileRequestOptions = {};

        if (fileProperties.contentSettings) {
            createOptions.contentSettings = fileProperties.contentSettings;
            createOptions.contentSettings.contentMD5 = undefined; // Needs to be filled in by SDK
        }

        await new Promise<void>((resolve, reject) => {
            fileService.createFileFromLocalFile(treeItem.share.name, treeItem.directoryPath, treeItem.file.name, filePath, createOptions, async (error?: Error, _result?: azureStorage.FileService.FileResult, _response?: azureStorage.ServiceResponse) => {
                if (!!error) {
                    let errorAny = <{ code?: string }>error;
                    if (!!errorAny.code) {
                        let humanReadableMessage = `Unable to save '${treeItem.file.name}', file service returned error code "${errorAny.code}"`;
                        switch (errorAny.code) {
                            case "ENOTFOUND":
                                humanReadableMessage += " - Please check connection.";
                                break;
                            default:
                                break;
                        }
                        reject(humanReadableMessage);
                    } else {
                        reject(error);
                    }
                } else {
                    resolve();
                }
            });
        });
    }

    private async getProperties(treeItem: FileTreeItem): Promise<azureStorage.FileService.FileResult> {
        let fileService = azureStorage.createFileService(treeItem.storageAccount.name, treeItem.key.value);

        return await new Promise<azureStorage.FileService.FileResult>((resolve, reject) => {
            fileService.getFileProperties(treeItem.share.name, treeItem.directoryPath, treeItem.file.name, (error?: Error, result?: azureStorage.FileService.FileResult, _response?: azureStorage.ServiceResponse) => {
                if (!!error) {
                    let errorAny = <{ code?: string }>error;
                    if (!!errorAny.code) {
                        let humanReadableMessage = `Unable to retrieve properties for '${treeItem.file.name}', file service returned error code "${errorAny.code}"`;
                        switch (errorAny.code) {
                            case "ENOTFOUND":
                                humanReadableMessage += " - Please check connection.";
                                break;
                            default:
                                break;
                        }
                        reject(humanReadableMessage);
                    } else {
                        reject(error);
                    }
                } else {
                    resolve(result);
                }
            });
        });
    }
}
