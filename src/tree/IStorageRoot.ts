/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import * as azureStorageShare from "@azure/storage-file-share";
import { Endpoints } from "azure-arm-storage/lib/models";
import * as azureStorage from "azure-storage";
import { ServiceClientCredentials } from "ms-rest";
import { AzureEnvironment } from "ms-rest-azure";
import { ISubscriptionContext } from "vscode-azureextensionui";
import { localize } from "../utils/localize";

export interface IStorageRoot extends ISubscriptionContext {
    storageAccountName: string;
    storageAccountId: string;
    isEmulated: boolean;
    isAttached: boolean;
    primaryEndpoints?: Endpoints;
    createBlobServiceClient(): azureStorageBlob.BlobServiceClient;
    createFileService(): azureStorage.FileService;
    createShareServiceClient(): azureStorageShare.ShareServiceClient;
    createQueueService(): azureStorage.QueueService;
    createTableService(): azureStorage.TableService;
}

export class AttachedAccountRoot implements ISubscriptionContext {
    private _error: Error = new Error(localize('cannotRetrieveAzureSubscriptionInfoForAttachedAccount', 'Cannot retrieve Azure subscription information for an attached account.'));

    public get credentials(): ServiceClientCredentials {
        throw this._error;
    }

    public get subscriptionDisplayName(): string {
        throw this._error;
    }

    public get subscriptionId(): string {
        throw this._error;
    }

    public get subscriptionPath(): string {
        throw this._error;
    }

    public get tenantId(): string {
        throw this._error;
    }

    public get userId(): string {
        throw this._error;
    }

    public get environment(): AzureEnvironment {
        throw this._error;
    }
}

export class AttachedStorageRoot extends AttachedAccountRoot {
    public isAttached: boolean = true;
    public storageAccountName: string;
    public isEmulated: boolean;

    // tslint:disable-next-line:typedef
    private readonly _serviceClientPipelineOptions = { retryOptions: { maxTries: 2 } };
    private _connectionString: string;

    constructor(connectionString: string, storageAccountName: string, isEmulated: boolean) {
        super();
        this._connectionString = connectionString;
        this.storageAccountName = storageAccountName;
        this.isEmulated = isEmulated;
    }

    public get storageAccountId(): string {
        throw new Error(localize('cannotRetrieveStorageAccountIdForAttachedAccount', 'Cannot retrieve storage account id for an attached account.'));
    }

    public createBlobServiceClient(): azureStorageBlob.BlobServiceClient {
        return azureStorageBlob.BlobServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public createFileService(): azureStorage.FileService {
        return new azureStorage.FileService(this._connectionString);
    }

    public createShareServiceClient(): azureStorageShare.ShareServiceClient {
        return azureStorageShare.ShareServiceClient.fromConnectionString(this._connectionString, this._serviceClientPipelineOptions);
    }

    public createQueueService(): azureStorage.QueueService {
        return new azureStorage.QueueService(this._connectionString);
    }

    public createTableService(): azureStorage.TableService {
        return new azureStorage.TableService(this._connectionString);
    }
}
