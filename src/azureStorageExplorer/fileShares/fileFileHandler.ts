/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileNode } from './fileNode';
import * as azureStorage from "azure-storage";
import { IAzureNode } from 'vscode-azureextensionui';
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';

export class FileFileHandler implements IRemoteFileHandler<IAzureNode<FileNode>> {
    async getSaveConfirmationText(node: IAzureNode<FileNode>): Promise<string> {
        return `Saving '${node.treeItem.file.name}' will update the file "${node.treeItem.file.name}" in File Share "${node.treeItem.share.name}"`;
    }

    async getFilename(node: IAzureNode<FileNode>): Promise<string> {
        return node.treeItem.file.name;
    }

    async downloadFile(node: IAzureNode<FileNode>, filePath: string): Promise<void> {
        let fileService = azureStorage.createFileService(node.treeItem.storageAccount.name, node.treeItem.key.value);
        return await new Promise<void>((resolve, reject) => {
            fileService.getFileToLocalFile(node.treeItem.share.name, node.treeItem.directoryPath, node.treeItem.file.name, filePath, (error: Error, _result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                if (!!error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async uploadFile(node: IAzureNode<FileNode>, filePath: string): Promise<void> {
        let fileService = azureStorage.createFileService(node.treeItem.storageAccount.name, node.treeItem.key.value);
        let fileProperties = await this.getProperties(node);
        let createOptions: azureStorage.FileService.CreateFileRequestOptions = {};

        if (fileProperties && fileProperties.contentSettings && fileProperties.contentSettings.contentType) {
            createOptions.contentSettings = { contentType: fileProperties.contentSettings.contentType };
        }

        await new Promise<void>((resolve, reject) => {
            fileService.createFileFromLocalFile(node.treeItem.share.name, node.treeItem.directoryPath, node.treeItem.file.name, filePath, createOptions, async (error: Error, _result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                if (!!error) {
                    let errorAny = <any>error;
                    if (!!errorAny.code) {
                        let humanReadableMessage = `Unable to save '${node.treeItem.file.name}', file service returned error code "${errorAny.code}"`;
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

    private async getProperties(node: IAzureNode<FileNode>): Promise<azureStorage.FileService.FileResult> {
        let fileService = azureStorage.createFileService(node.treeItem.storageAccount.name, node.treeItem.key.value);

        return await new Promise<azureStorage.FileService.FileResult>((resolve, reject) => {
            fileService.getFileProperties(node.treeItem.share.name, node.treeItem.directoryPath, node.treeItem.file.name, (error: Error, result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                if (!!error) {
                    let errorAny = <any>error;
                    if (!!errorAny.code) {
                        let humanReadableMessage = `Unable to retrieve properties for '${node.treeItem.file.name}', file service returned error code "${errorAny.code}"`;
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
