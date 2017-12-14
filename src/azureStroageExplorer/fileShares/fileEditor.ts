/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileNode } from './fileNode';
import * as azureStorage from "azure-storage";
import { BaseEditor } from '../../azureServiceExplorer/editors/baseEditor';
import { AzureStorageOutputChanel } from '../azureStorageOutputChannel';
import { IAzureNode } from 'vscode-azureextensionui';

export class FileEditor extends BaseEditor<IAzureNode<FileNode>> {
    constructor() {
        super("azureStorage.file.showSavePrompt", AzureStorageOutputChanel)
    }

    async getSaveConfirmationText(node: IAzureNode<FileNode>): Promise<string> {
        return `Saving '${node.treeItem.file.name}' will update the file "${node.treeItem.file.name}" in File Share "${node.treeItem.share.name}"`;
    }

    async getFilename(node: IAzureNode<FileNode>): Promise<string> {
        return node.treeItem.file.name;
    }

    async getSize(node: IAzureNode<FileNode>): Promise<number> {
        return Number(node.treeItem.file.contentLength)/(1024*1024);
    }

    async getData(node: IAzureNode<FileNode>): Promise<string> {
        var fileService = azureStorage.createFileService(node.treeItem.storageAccount.name, node.treeItem.key.value);
        return await new Promise<string>((resolve, reject) => {
            fileService.getFileToText(node.treeItem.share.name, node.treeItem.directory, node.treeItem.file.name, undefined, (error: Error, text: string, _result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    reject(error)
                } else {
                    resolve(text);
                }
            });
        });
    }

    async updateData(node: IAzureNode<FileNode>, data: string): Promise<string> {
        var fileService = azureStorage.createFileService(node.treeItem.storageAccount.name, node.treeItem.key.value);
        var fileProperties = await this.getProperties(node);
        var createOptions: azureStorage.FileService.CreateFileRequestOptions = {};
        
        if(fileProperties && fileProperties.contentSettings && fileProperties.contentSettings.contentType){
            createOptions.contentSettings = { contentType: fileProperties.contentSettings.contentType };
        }

        await new Promise<string>((resolve, reject) => {
            fileService.createFileFromText(node.treeItem.share.name, node.treeItem.directory, node.treeItem.file.name, data, createOptions, async (error: Error, _result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    var errorAny = <any>error;                
                    if(!!errorAny.code) {
                        var humanReadableMessage = `Unable to save '${node.treeItem.file.name}' file service returned error code "${errorAny.code}"`;
                        switch(errorAny.code) {
                            case "ENOTFOUND":
                                humanReadableMessage += " - Please check connection."
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

        return await this.getData(node);
    }

    private async getProperties(node: IAzureNode<FileNode>): Promise<azureStorage.FileService.FileResult> {
        var fileService = azureStorage.createFileService(node.treeItem.storageAccount.name, node.treeItem.key.value);

        return await new Promise<azureStorage.FileService.FileResult>((resolve, reject) => {
            fileService.getFileProperties(node.treeItem.share.name, node.treeItem.directory, node.treeItem.file.name, (error: Error, result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    var errorAny = <any>error;                
                    if(!!errorAny.code) {
                        var humanReadableMessage = `Unable to retrieve properties for '${node.treeItem.file.name}' file service returned error code "${errorAny.code}"`;
                        switch(errorAny.code) {
                            case "ENOTFOUND":
                                humanReadableMessage += " - Please check connection."
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