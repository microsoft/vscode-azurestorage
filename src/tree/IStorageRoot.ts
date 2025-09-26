/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TableServiceClient } from "@azure/data-tables";
import type { AccountSASSignatureValues as AccountSASSignatureValuesBlob, BlobServiceClient } from "@azure/storage-blob";
import type { AccountSASSignatureValues as AccountSASSignatureValuesFileShare, ShareServiceClient } from "@azure/storage-file-share";
import type { QueueServiceClient } from "@azure/storage-queue";

import { type Endpoints, type StorageManagementClient } from "@azure/arm-storage";
import { type IActionContext } from "@microsoft/vscode-azext-utils";

export interface IStorageRoot {
    storageAccountName: string;
    storageAccountId: string;
    tenantId: string;
    isEmulated: boolean;
    allowSharedKeyAccess: boolean;
    primaryEndpoints?: Endpoints;
    getAccessToken(): Promise<string>;
    generateSasToken(accountSASSignatureValues: AccountSASSignatureValuesBlob | AccountSASSignatureValuesFileShare): string;
    getStorageManagementClient(context: IActionContext): Promise<StorageManagementClient>;
    createBlobServiceClient(): Promise<BlobServiceClient>;
    createShareServiceClient(): Promise<ShareServiceClient>;
    createQueueServiceClient(): Promise<QueueServiceClient>;
    createTableServiceClient(): Promise<TableServiceClient>;
}
