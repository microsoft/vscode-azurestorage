/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BlobNode } from './blobNode';
import * as azureStorage from "azure-storage";

import { IAzureNode } from 'vscode-azureextensionui';
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';

export class BlobFileHandler implements IRemoteFileHandler<IAzureNode<BlobNode>> {
    async getSaveConfirmationText(node: IAzureNode<BlobNode>): Promise<string> {
        return `Saving '${node.treeItem.blob.name}' will update the blob "${node.treeItem.blob.name}" in Blob Container "${node.treeItem.container.name}"`;
    }

    async getFilename(node: IAzureNode<BlobNode>): Promise<string> {
        return node.treeItem.blob.name;
    }

    async downloadFile(node: IAzureNode<BlobNode>, filePath: string): Promise<void> {
        var blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, node.treeItem.key.value);      
        return await new Promise<void>((resolve, reject) => {         
            if(!node.treeItem.blob.blobType.toLocaleLowerCase().startsWith("block")) {
                reject(`Editing blobs of type '${node.treeItem.blob.blobType}' is not supported. Please use Storage Explorer to work with these blobs.`);
            }

            blobService.getBlobToLocalFile(node.treeItem.container.name, node.treeItem.blob.name, filePath, (error: Error, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                if(!!error) {
                    reject(error)
                } else {
                    resolve();
                }
            });
        });
    }

    async uploadFile(node: IAzureNode<BlobNode>, filePath: string) {
        var blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, node.treeItem.key.value);  
        var createOptions: azureStorage.BlobService.CreateBlockBlobRequestOptions = {};
        
        if(node.treeItem.blob && node.treeItem.blob.contentSettings && node.treeItem.blob.contentSettings.contentType){
            createOptions.contentSettings = {contentType: node.treeItem.blob.contentSettings.contentType };
        }

        await new Promise<string>((resolve, reject) => {
            blobService.createBlockBlobFromLocalFile(node.treeItem.container.name, node.treeItem.blob.name, filePath, createOptions, (error: Error, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
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
    }
}