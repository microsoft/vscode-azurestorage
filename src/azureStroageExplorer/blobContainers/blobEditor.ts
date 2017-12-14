/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BlobNode } from './blobNode';
import * as azureStorage from "azure-storage";
import { BaseEditor } from '../../azureServiceExplorer/editors/baseEditor';
import { AzureStorageOutputChanel } from '../azureStorageOutputChannel';

import { IAzureNode } from 'vscode-azureextensionui';
export class BlobEditor extends BaseEditor<IAzureNode<BlobNode>> {
    constructor() {
        super("azureStorage.blob.showSavePrompt", AzureStorageOutputChanel)
    }

    async getSaveConfirmationText(node: IAzureNode<BlobNode>): Promise<string> {
        return `Saving '${node.treeItem.blob.name}' will update the blob "${node.treeItem.blob.name}" in Blob Container "${node.treeItem.container.name}"`;
    }

    async getFilename(node: IAzureNode<BlobNode>): Promise<string> {
        return node.treeItem.blob.name;
    }

    async getSize(node: IAzureNode<BlobNode>): Promise<number> {
        return Number(node.treeItem.blob.contentLength)/(1024*1024);
    }

    async getData(node: IAzureNode<BlobNode>): Promise<string> {
        var blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, node.treeItem.key.value);
        return await new Promise<string>((resolve, reject) => {

            if(!node.treeItem.blob.blobType.toLocaleLowerCase().startsWith("block")) {
                reject(`Editing blobs of type '${node.treeItem.blob.blobType}' is not supported. Please use Storage Explorer to work with these blobs.`);
            }

            blobService.getBlobToText(node.treeItem.container.name, node.treeItem.blob.name, (error: Error, text: string, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    reject(error)
                } else {
                    resolve(text);
                }
            });
        });
    }

    async updateData(node: IAzureNode<BlobNode>, data: string): Promise<string> {
        var blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, node.treeItem.key.value);  
        var createOptions: azureStorage.BlobService.CreateBlockBlobRequestOptions = {};
        
        if(node.treeItem.blob && node.treeItem.blob.contentSettings && node.treeItem.blob.contentSettings.contentType){
            createOptions.contentSettings = {contentType: node.treeItem.blob.contentSettings.contentType };
        }


        await new Promise<string>((resolve, reject) => {
            blobService.createBlockBlobFromText(node.treeItem.container.name, node.treeItem.blob.name, data, createOptions, (error: Error, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    var errorAny = <any>error;                
                    if(!!errorAny.code) {
                        var humanReadableMessage = `Unable to save '${node.treeItem.blob.name}' blob service returned error code "${errorAny.code}"`;
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