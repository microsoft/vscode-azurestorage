/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import * as azureStorage from "azure-storage";
import { ISubscriptionContext } from "vscode-azureextensionui";
import { StorageAccountWrapper } from "../components/storageWrappers";

export interface IStorageRoot extends ISubscriptionContext {
    storageAccount: StorageAccountWrapper;
    createBlobServiceClient(): azureStorageBlob.BlobServiceClient;
    createFileService(): azureStorage.FileService;
    createQueueService(): azureStorage.QueueService;
    createTableService(): azureStorage.TableService;
}
