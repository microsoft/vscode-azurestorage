/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BlobNode } from './blobNode';
import * as azureStorage from "azure-storage";
import { BaseEditor } from 'vscode-azureextensionui';
import { AzureStorageOutputChanel } from '../azureStorageOutputChannel';

export class BlobEditor extends BaseEditor<BlobNode> {
    constructor() {
        super("azureStorage.blob.showSavePrompt", AzureStorageOutputChanel)
    }

    async getSaveConfirmationText(node: BlobNode): Promise<string> {
        return `Saving '${node.blob.name}' will update the blob "${node.blob.name}" in Blob Container "${node.container.name}"`;
    }

    async getFilename(node: BlobNode): Promise<string> {
        return node.blob.name;
    }

    async getSize(node: BlobNode): Promise<number> {
        return Number(node.blob.contentLength)/(1024*1024);
    }

    async getData(node: BlobNode): Promise<string> {
        var blobService = azureStorage.createBlobService(node.storageAccount.name, node.key.value);
        return await new Promise<string>((resolve, reject) => {

            if(!node.blob.blobType.toLocaleLowerCase().startsWith("block")) {
                reject(`Editing blobs of type '${node.blob.blobType}' is not supported. Please use Storage Explorer to work with these blobs.`);
            }

            blobService.getBlobToText(node.container.name, node.blob.name, (error: Error, text: string, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    reject(error)
                } else {
                    resolve(text);
                }
            });
        });
    }

    async updateData(node: BlobNode, data: string): Promise<string> {
        var blobService = azureStorage.createBlobService(node.storageAccount.name, node.key.value);  
        
        await new Promise<string>((resolve, reject) => {
            blobService.createBlockBlobFromText(node.container.name, node.blob.name, data, (error: Error, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    var errorAny = <any>error;                
                    if(!!errorAny.code) {
                        var humanReadableMessage = `Unable to save '${node.blob.name}' blob service returned error code "${errorAny.code}"`;
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
}