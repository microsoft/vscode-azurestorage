/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as fse from 'fs-extra';
import { Uri } from 'vscode';
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';
import { awaitWithProgress } from '../../components/progress';
import { ext } from "../../extensionVariables";
import { Limits } from '../limits';
import { BlobContainerTreeItem } from './blobContainerNode';
import { BlobTreeItem } from './blobNode';
import { updateBlockBlobFromLocalFile } from './blobUtils';

export class BlobFileHandler implements IRemoteFileHandler<BlobTreeItem> {
    async getSaveConfirmationText(treeItem: BlobTreeItem): Promise<string> {
        return `Saving '${treeItem.blob.name}' will update the blob "${treeItem.blob.name}" in Blob Container "${treeItem.container.name}"`;
    }

    async getFilename(treeItem: BlobTreeItem): Promise<string> {
        return treeItem.blob.name;
    }

    public async checkCanDownload(treeItem: BlobTreeItem): Promise<void> {
        let message: string | undefined;

        if (Number(treeItem.blob.contentLength) > Limits.maxUploadDownloadSizeBytes) {
            message = `Please use Storage Explorer for blobs larger than ${Limits.maxUploadDownloadSizeMB}MB.`;
        } else if (!treeItem.blob.blobType.toLocaleLowerCase().startsWith("block")) {
            message = `Please use Storage Explorer for blobs of type '${treeItem.blob.blobType}'.`;
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

        const blob = treeItem.blob;
        const linkablePath = Uri.file(filePath); // Allows CTRL+Click in Output panel
        const blobService = treeItem.root.createBlobService();

        ext.outputChannel.show();
        ext.outputChannel.appendLine(`Downloading ${blob.name} to ${filePath}...`);

        let speedSummary: azureStorage.common.streams.speedsummary.SpeedSummary;
        const promise = new Promise((resolve, reject): void => {
            // tslint:disable-next-line:no-function-expression // Grandfathered in
            speedSummary = blobService.getBlobToLocalFile(treeItem.container.name, blob.name, filePath, function (err?: {}): void {
                // tslint:disable-next-line:no-void-expression // Grandfathered in
                err ? reject(err) : resolve();
            });
        });

        await awaitWithProgress(
            `Downloading ${blob.name}`,
            promise,
            () => {
                const completed = <string>speedSummary.getCompleteSize(true);
                const total = <string>speedSummary.getTotalSize(true);
                const percent = speedSummary.getCompletePercent(0);
                const msg = `${blob.name}: ${completed}/${total} (${percent}%)`;
                return msg;
            });

        ext.outputChannel.appendLine(`Successfully downloaded ${linkablePath}.`);
    }

    async uploadFile(treeItem: BlobTreeItem, filePath: string): Promise<void> {
        await this.checkCanUpload(treeItem, filePath);
        await updateBlockBlobFromLocalFile(treeItem.blob.name, treeItem.container.name, treeItem.root, filePath);
    }
}
