/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { IStorageRoot } from "../IStorageRoot";

export async function updateBlockBlobFromLocalFile(blobName: string, containerName: string, root: IStorageRoot, filePath: string): Promise<void> {
    const createOptions = await getExistingCreateOptions(blobName, containerName, root);
    await createBlockBlobFromLocalFile(blobName, containerName, root, filePath, createOptions);
}

export async function getExistingCreateOptions(blobName: string, containerName: string, root: IStorageRoot): Promise<azureStorage.BlobService.CreateBlobRequestOptions> {
    let blobService = root.createBlobService();
    const propertiesResult: azureStorage.BlobService.BlobResult = await new Promise((resolve, reject) => {
        blobService.getBlobProperties(containerName, blobName, (err?: Error, result?: azureStorage.BlobService.BlobResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

    if (propertiesResult.contentSettings) {
        // Don't allow the existing MD5 hash to be used for the updated blob
        propertiesResult.contentSettings.contentMD5 = '';
    }

    const metadataResult: azureStorage.BlobService.BlobResult = await new Promise((resolve, reject) => {
        blobService.getBlobMetadata(containerName, blobName, (err?: Error, result?: azureStorage.BlobService.BlobResult) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

    return {
        contentSettings: propertiesResult.contentSettings,
        metadata: metadataResult.metadata
    };
}

async function createBlockBlobFromLocalFile(blobName: string, containerName: string, root: IStorageRoot, filePath: string, createOptions?: azureStorage.BlobService.CreateBlobRequestOptions): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        let blobService = root.createBlobService();
        blobService.createBlockBlobFromLocalFile(containerName, blobName, filePath, createOptions ? createOptions : {}, (err?: Error) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
