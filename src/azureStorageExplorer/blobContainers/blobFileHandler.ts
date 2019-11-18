/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import { Uri } from 'vscode';
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';
import { ext } from "../../extensionVariables";
import { Limits } from '../limits';
import { BlobContainerTreeItem } from './blobContainerNode';
import { BlobTreeItem } from './blobNode';
import { getExistingProperties } from "./blobUtils";

export class BlobFileHandler implements IRemoteFileHandler<BlobTreeItem> {
    async getSaveConfirmationText(treeItem: BlobTreeItem): Promise<string> {
        return `Saving '${treeItem.blob.name}' will update the blob "${treeItem.blob.name}" in Blob Container "${treeItem.container.name}"`;
    }

    async getFilename(treeItem: BlobTreeItem): Promise<string> {
        return treeItem.blob.name;
    }

    public async checkCanDownload(treeItem: BlobTreeItem): Promise<void> {
        let message: string | undefined;

        if (Number(treeItem.blob.properties.contentLength) > Limits.maxUploadDownloadSizeBytes) {
            message = `Please use Storage Explorer for blobs larger than ${Limits.maxUploadDownloadSizeMB}MB.`;
        } else if (treeItem.blob.properties.blobType && !treeItem.blob.properties.blobType.toLocaleLowerCase().startsWith("block")) {
            message = `Please use Storage Explorer for blobs of type '${treeItem.blob.properties.blobType}'.`;
        }

        if (message) {
            await Limits.askOpenInStorageExplorer(message, treeItem.root.storageAccount.id, treeItem.root.subscriptionId, 'Azure.BlobContainer', treeItem.container.name);
        }
    }

    public async checkCanUpload(treeItem: BlobContainerTreeItem | BlobTreeItem, localPath: string): Promise<void> {
        let size = await this.getLocalFileSize(localPath);
        if (size > Limits.maxUploadDownloadSizeBytes) {
            await Limits.askOpenInStorageExplorer(
                `Please use Storage Explorer to upload files larger than ${Limits.maxUploadDownloadSizeMB}MB.`,
                treeItem.root.storageAccount.id,
                treeItem.root.subscriptionId,
                'Azure.BlobContainer',
                treeItem.container.name);
        }
    }

    private async getLocalFileSize(localPath: string): Promise<number> {
        let stat = await fse.stat(localPath);
        return stat.size;
    }

    public async downloadFile(treeItem: BlobTreeItem, filePath: string): Promise<void> {
        await this.checkCanDownload(treeItem);
        const linkablePath = Uri.file(filePath); // Allows CTRL+Click in Output panel
        const blockBlobClient = treeItem.root.createBlockBlobClient(treeItem.container.name, treeItem.fullPath);
        await blockBlobClient.downloadToFile(filePath);
        ext.outputChannel.appendLine(`Successfully downloaded ${linkablePath}.`);
    }

    async uploadFile(treeItem: BlobTreeItem, filePath: string): Promise<void> {
        await this.checkCanUpload(treeItem, filePath);
        const blockBlobClient = treeItem.root.createBlockBlobClient(treeItem.container.name, treeItem.fullPath);
        await blockBlobClient.uploadFile(filePath, await getExistingProperties(treeItem, treeItem.fullPath));
        2;
    }
}
