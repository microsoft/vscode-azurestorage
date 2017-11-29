/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BlobNode } from './blobNode';
import * as azureStorage from "azure-storage";
import { BaseEditor } from '../../azureServiceExplorer/editors/baseEditor';

export class BlobEditor extends BaseEditor<BlobNode> {
    async getSaveConfirmationText(node: BlobNode): Promise<string> {
        return `Saving '${node.blob.name}' will update the blob "${node.blob.name}" in Blob Container "${node.container.name}"`;
    }

    async getFilename(node: BlobNode): Promise<string> {
        return node.blob.name;
    }

    async getData(node: BlobNode): Promise<string> {
        var blobService = azureStorage.createBlobService(node.storageAccount.name, node.key.value);
        return await new Promise<string>((resolve, _reject) => {
            blobService.getBlobToText(node.container.name, node.blob.name, (_error: Error, text: string, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                resolve(text);
            });
        });
    }

    async updateData(node: BlobNode, data: string): Promise<string> {
        var blobService = azureStorage.createBlobService(node.storageAccount.name, node.key.value);  
        return new Promise<string>((resolve, _reject) => {
            blobService.createBlockBlobFromText(node.container.name, node.blob.name, data, async () => {
                resolve(await this.getData(node));
            });
        });
    }
}