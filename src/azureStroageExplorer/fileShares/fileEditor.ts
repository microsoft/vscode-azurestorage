/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileNode } from './fileNode';
import * as azureStorage from "azure-storage";
import { BaseEditor } from '../../azureServiceExplorer/editors/baseEditor';

export class FileEditor extends BaseEditor<FileNode> {
    constructor() {
        super('azureStorage.blob.dontShow.SaveEqualsUpdateToAzure')
    }

    async getSaveConfirmationText(node: FileNode): Promise<string> {
        return `Saving '${node.file.name}' will update the file "${node.file.name}" in File Share "${node.share.name}"`;
    }

    async getFilename(node: FileNode): Promise<string> {
        return node.file.name;
    }

    async getData(node: FileNode): Promise<string> {
        var fileService = azureStorage.createFileService(node.storageAccount.name, node.key.value);
        return await new Promise<string>((resolve, _reject) => {
            fileService.getFileToText(node.share.name, '', node.file.name, undefined, (_error: Error, text: string, _result: azureStorage.FileService.FileResult, _response: azureStorage.ServiceResponse) => {
                resolve(text);
            });
        });
    }

    async updateData(node: FileNode, data: string): Promise<string> {
        var fileService = azureStorage.createFileService(node.storageAccount.name, node.key.value);  
        return new Promise<string>((resolve, _reject) => {
            fileService.createFileFromText(node.share.name, '', node.file.name, data, async () => {
                resolve(await this.getData(node));
            });
        });
    }
}