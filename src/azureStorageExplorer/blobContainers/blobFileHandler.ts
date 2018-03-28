/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BlobNode } from './blobNode';
import * as azureStorage from "azure-storage";

import { IAzureNode, TelemetryProperties } from 'vscode-azureextensionui';
import { IRemoteFileHandler } from '../../azureServiceExplorer/editors/IRemoteFileHandler';
import { Limits } from '../limits';
import { Uri, OutputChannel } from 'vscode';
import { azureStorageOutputChannel } from '../azureStorageOutputChannel';
import { awaitWithProgress } from '../../components/progress';
import { BlobContainerNode } from './blobContainerNode';
import * as fse from 'fs-extra';

export class BlobFileHandler implements IRemoteFileHandler<IAzureNode<BlobNode>> {
    private _channel: OutputChannel = azureStorageOutputChannel;

    async getSaveConfirmationText(node: IAzureNode<BlobNode>): Promise<string> {
        return `Saving '${node.treeItem.blob.name}' will update the blob "${node.treeItem.blob.name}" in Blob Container "${node.treeItem.container.name}"`;
    }

    async getFilename(node: IAzureNode<BlobNode>): Promise<string> {
        return node.treeItem.blob.name;
    }

    public async checkCanDownload(node: IAzureNode<BlobNode>, properties: TelemetryProperties): Promise<void> {
        let message: string;
        let blobType = node.treeItem.blob.blobType;

        if (Number(node.treeItem.blob.contentLength) > Limits.maxUploadDownloadSizeBytes) {
            properties.cancelStep = 'MustOpenInStorageExplorer:TooLarge';
            message = `Please use Storage Explorer for blobs larger than ${Limits.maxUploadDownloadSizeMB}MB.`;
        } else if (!blobType.startsWith("block")) {
            properties.cancelStep = 'MustOpenInStorageExplorer:WrongBlobType';
            properties.blobType = blobType;
            message = `Please use Storage Explorer for blobs of type '${node.treeItem.blob.blobType}'.`;
        }

        if (message) {
            await Limits.askOpenInStorageExplorer(message, node.treeItem.storageAccount.id, node.subscription.subscriptionId, 'Azure.BlobContainer', node.treeItem.container.name);
        }
    }

    public async checkCanUpload(node: IAzureNode<BlobContainerNode> | IAzureNode<BlobNode>, localPath: string, properties: TelemetryProperties): Promise<void> {
        let size = await this.getLocalFileSize(localPath);
        if (size > Limits.maxUploadDownloadSizeBytes) {
            properties.cancelStep = 'MustOpenInStorageExplorer:TooLarge';
            await Limits.askOpenInStorageExplorer(
                `Please use Storage Explorer to upload files larger than ${Limits.maxUploadDownloadSizeMB}MB.`,
                node.treeItem.storageAccount.id,
                node.subscription.subscriptionId,
                'Azure.BlobContainer',
                node.treeItem.container.name);
        }
    }

    public async getLocalFileSize(localPath: string): Promise<number> {
        let stat = await fse.stat(localPath);
        return stat.size;
    }

    public async downloadFile(node: IAzureNode<BlobNode>, filePath: string, properties: TelemetryProperties): Promise<void> {
        properties.size = node.treeItem.blob.contentLength;

        await this.checkCanDownload(node, properties);

        const blob = node.treeItem.blob;
        const treeItem = node.treeItem;
        const linkablePath = Uri.file(filePath); // Allows CTRL+Click in Output panel
        const blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, treeItem.key.value);

        this._channel.show();
        this._channel.appendLine(`Downloading ${blob.name} to ${filePath}...`);

        let speedSummary;
        const promise = new Promise((resolve, reject): void => {
            speedSummary = blobService.getBlobToLocalFile(treeItem.container.name, blob.name, filePath, function (err: any): void {
                err ? reject(err) : resolve();
            });
        });

        await awaitWithProgress(
            `Downloading ${blob.name}`,
            this._channel,
            promise, () => {
                const completed = <string>speedSummary.getCompleteSize(true);
                const total = <string>speedSummary.getTotalSize(true);
                const percent = speedSummary.getCompletePercent(0);
                const msg = `${blob.name}: ${completed}/${total} (${percent}%)`;
                return msg;
            });

        this._channel.appendLine(`Successfully downloaded ${linkablePath}.`);
    }

    async uploadFile(node: IAzureNode<BlobNode>, filePath: string, properties: TelemetryProperties): Promise<void> {
        await this.checkCanUpload(node, filePath, properties);

        let blobService = azureStorage.createBlobService(node.treeItem.storageAccount.name, node.treeItem.key.value);
        let createOptions: azureStorage.BlobService.CreateBlockBlobRequestOptions = {};

        if (node.treeItem.blob && node.treeItem.blob.contentSettings && node.treeItem.blob.contentSettings.contentType) {
            createOptions.contentSettings = { contentType: node.treeItem.blob.contentSettings.contentType };
        }

        await new Promise<void>((resolve, reject) => {
            blobService.createBlockBlobFromLocalFile(node.treeItem.container.name, node.treeItem.blob.name, filePath, createOptions, (error: Error, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
                if (!!error) {
                    let errorAny = <any>error;
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
