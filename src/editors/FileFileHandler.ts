/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileTreeItem } from "../tree/fileShare/FileTreeItem";
import { updateFileFromLocalFile } from '../utils/fileUtils';
import { createFileClient } from '../utils/fileUtils';
import { IRemoteFileHandler } from './IRemoteFileHandler';

export class FileFileHandler implements IRemoteFileHandler<FileTreeItem> {
    async getSaveConfirmationText(treeItem: FileTreeItem): Promise<string> {
        return `Saving '${treeItem.fileName}' will update the file "${treeItem.fileName}" in File Share "${treeItem.shareName}"`;
    }

    async getFilename(treeItem: FileTreeItem): Promise<string> {
        return treeItem.fileName;
    }

    async downloadFile(treeItem: FileTreeItem, filePath: string): Promise<void> {
        const fileClient = createFileClient(treeItem.root, treeItem.shareName, treeItem.directoryPath, treeItem.fileName);
        await fileClient.downloadToFile(filePath);
    }

    async uploadFile(treeItem: FileTreeItem, filePath: string): Promise<void> {
        await updateFileFromLocalFile(treeItem.directoryPath, treeItem.fileName, treeItem.shareName, treeItem.root, filePath);
    }
}
