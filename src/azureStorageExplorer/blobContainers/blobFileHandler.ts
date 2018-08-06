/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { BlobNode } from './blobNode';

import * as fse from 'fs-extra';
import { Uri } from 'vscode';
import { IAzureNode } from 'vscode-azureextensionui';
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';
import { awaitWithProgress } from '../../components/progress';
import { ext } from "../../extensionVariables";
import { Limits } from '../limits';
import { BlobContainerNode } from './blobContainerNode';

export class BlobFileHandler implements IRemoteFileHandler<IAzureNode<BlobNode>> {
    async getSaveConfirmationText(node: IAzureNode<BlobNode>): Promise<string> {
        return `Saving '${node.treeItem.blob.name}' will update the blob "${node.treeItem.blob.name}" in Blob Container "${node.treeItem.container.name}"`;
    }

    async getFilename(node: IAzureNode<BlobNode>): Promise<string> {
        return node.treeItem.blob.name;
    }

    public async checkCanDownload(node: IAzureNode<BlobNode>): Promise<void> {
        let message: string | undefined;

        if (Number(node.treeItem.blob.contentLength) > Limits.maxUploadDownloadSizeBytes) {
            message = `Please use Storage Explorer for blobs larger than ${Limits.maxUploadDownloadSizeMB}MB.`;
        } else if (!node.treeItem.blob.blobType.toLocaleLowerCase().startsWith("block")) {
            message = `Please use Storage Explorer for blobs of type '${node.treeItem.blob.blobType}'.`;
        }

        if (message) {
            await Limits.askOpenInStorageExplorer(message, node.treeItem.storageAccount.id, node.subscriptionId, 'Azure.BlobContainer', node.treeItem.container.name);
        }
    }

    public async checkCanUpload(node: IAzureNode<BlobContainerNode> | IAzureNode<BlobNode>, localPath: string): Promise<void> {
        let size = await this.getLocalFileSize(localPath);
        if (size > Limits.maxUploadDownloadSizeBytes) {
            await Limits.askOpenInStorageExplorer(
                `Please use Storage Explorer to upload files larger than ${Limits.maxUploadDownloadSizeMB}MB.`,
                node.treeItem.storageAccount.id,
                node.subscriptionId,
                'Azure.BlobContainer',
                node.treeItem.container.name);
        }
    }

    private async getLocalFileSize(localPath: string): Promise<number> {
        let stat = await fse.stat(localPath);
        return stat.size;
    }

    public async downloadFile(node: IAzureNode<BlobNode>, filePath: string): Promise<void> {
        await this.checkCanDownload(node);

        const blob = node.treeItem.blob;
        const treeItem = node.treeItem;
        const linkablePath = Uri.file(filePath); // Allows CTRL+Click in Output panel
        const blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, treeItem.key.value);

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

    async uploadFile(node: IAzureNode<BlobNode>, filePath: string): Promise<void> {
        await this.checkCanUpload(node, filePath);

        let blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, node.treeItem.key.value);
        let createOptions: azureStorage.BlobService.CreateBlockBlobRequestOptions = {};

        if (node.treeItem.blob.contentSettings) {
            createOptions.contentSettings = node.treeItem.blob.contentSettings;
            createOptions.contentSettings.contentMD5 = undefined; // Needs to be filled in by SDK
        }

        await new Promise<void>((resolve, reject) => {
            blobService.createBlockBlobFromLocalFile(node.treeItem.container.name, node.treeItem.blob.name, filePath, createOptions, (error?: Error, _result?: azureStorage.BlobService.BlobResult, _response?: azureStorage.ServiceResponse) => {
                if (!!error) {
                    let errorAny = <{ code?: string }>error;
                    if (!!errorAny.code) {
                        let humanReadableMessage = `Unable to save '${node.treeItem.blob.name}', blob service returned error code "${errorAny.code}"`;
                        switch (errorAny.code) {
                            case "ENOTFOUND":
                                humanReadableMessage += " - Please check connection.";
                                break;
                            default:
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
