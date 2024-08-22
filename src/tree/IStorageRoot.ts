/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TableServiceClient } from "@azure/data-tables";
import type { AccountSASSignatureValues as AccountSASSignatureValuesBlob, BlobServiceClient } from "@azure/storage-blob";
import type { AccountSASSignatureValues as AccountSASSignatureValuesFileShare, ShareServiceClient } from "@azure/storage-file-share";
import type { QueueServiceClient } from "@azure/storage-queue";

import { Endpoints } from "@azure/arm-storage";

export interface IStorageRoot {
    storageAccountName: string;
    storageAccountId: string;
    isEmulated: boolean;
    primaryEndpoints?: Endpoints;
    generateSasToken(accountSASSignatureValues: AccountSASSignatureValuesBlob | AccountSASSignatureValuesFileShare): string;
    createBlobServiceClient(): Promise<BlobServiceClient>;
    createShareServiceClient(): Promise<ShareServiceClient>;
    createQueueServiceClient(): Promise<QueueServiceClient>;
    createTableServiceClient(): Promise<TableServiceClient>;
}
