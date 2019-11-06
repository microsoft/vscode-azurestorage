/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';
import { updateFileFromLocalFile } from '../../azureStorageExplorer/fileShares/fileUtils';
import { FileTreeItem } from "./fileNode";

export class FileFileHandler implements IRemoteFileHandler<FileTreeItem> {
    async getSaveConfirmationText(treeItem: FileTreeItem): Promise<string> {
        return `Saving '${treeItem.file.name}' will update the file "${treeItem.file.name}" in File Share "${treeItem.share.name}"`;
    }

    async getFilename(treeItem: FileTreeItem): Promise<string> {
        return treeItem.file.name;
    }

    async downloadFile(treeItem: FileTreeItem, filePath: string): Promise<void> {
        let fileService = treeItem.root.createFileService();
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
        await updateFileFromLocalFile(treeItem.directoryPath, treeItem.file.name, treeItem.share, treeItem.root, filePath);
    }
}
