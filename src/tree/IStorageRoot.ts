/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementModels } from "@azure/arm-storage";
import * as azureDataTables from '@azure/data-tables';
import * as azureStorageBlob from "@azure/storage-blob";
import { AccountSASSignatureValues } from "@azure/storage-blob";
import * as azureStorageShare from "@azure/storage-file-share";
import * as azureStorageQueue from '@azure/storage-queue';

export interface IStorageRoot {
    storageAccountName: string;
    storageAccountId: string;
    isEmulated: boolean;
    primaryEndpoints?: StorageManagementModels.Endpoints;
    generateSasToken(accountSASSignatureValues: AccountSASSignatureValues): string;
    createBlobServiceClient(): azureStorageBlob.BlobServiceClient;
    createShareServiceClient(): azureStorageShare.ShareServiceClient;
    createQueueServiceClient(): azureStorageQueue.QueueServiceClient;
    createTableServiceClient(): azureDataTables.TableServiceClient;
}
