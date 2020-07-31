/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementModels } from "@azure/arm-storage";
import * as azureStorageBlob from "@azure/storage-blob";
import * as azureStorageShare from "@azure/storage-file-share";
import * as azureStorage from "azure-storage";
import { ISubscriptionContext } from "vscode-azureextensionui";

export interface IStorageRoot extends ISubscriptionContext {
    storageAccountName: string;
    storageAccountId: string;
    isEmulated: boolean;
    primaryEndpoints?: StorageManagementModels.Endpoints;
    createBlobServiceClient(): azureStorageBlob.BlobServiceClient;
    createShareServiceClient(): azureStorageShare.ShareServiceClient;
    createQueueService(): azureStorage.QueueService;
    createTableService(): azureStorage.TableService;
}
