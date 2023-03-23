/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { StorageAccount, StorageAccountKey } from '@azure/arm-storage';
import { BlobClient, BlobServiceClient, ContainerClient, ListBlobsFlatSegmentResponse, ListBlobsHierarchySegmentResponse, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DataLakeFileSystemClient, DataLakePathClient, DataLakeServiceClient, StorageSharedKeyCredential as StorageSharedKeyCredentialDataLake } from '@azure/storage-file-datalake';
import { parseAzureResourceId } from '@microsoft/vscode-azext-azureutils';
import { apiUtils, callWithTelemetryAndErrorHandling, createSubscriptionContext, IActionContext, parseError } from '@microsoft/vscode-azext-utils';
import { AzureSubscription } from '@microsoft/vscode-azureresources-api';
import * as mime from 'mime';
import * as vscode from 'vscode';
import { AzureAccountExtensionApi, AzureSubscription as AzureAccountSubscription } from './azure-account-api';
import { createStorageClient } from './utils/azureClients';
import { BlobPathUtils } from './utils/blobPathUtils';
import { localize } from './utils/localize';
import { StorageAccountKeyWrapper } from './utils/storageWrappers';

/**
 * A file system provider at the root of a blob container.
 */
export class BlobContainerFS implements vscode.FileSystemProvider {
    private static listBlobPageSize = 1000;

    private _onDidChangeFileEmitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFileEmitter.event;

    /**
     * Construct an Uri to a blob or a directory in the blob container.
     * The format of the Uri is:
     * azurestorageblob:///<containerName>?storageAccountId=<storage account id>
     * azurestorageblob:///<containerName>/<blob path>?storageAccountId=<storage account id>
     *
     * If {@link blobPath} is not specified, the Uri points to the root of the container.
     */
    static constructUri(containerName: string, storageAccountId: string, blobPath?: string): vscode.Uri {
        return vscode.Uri.parse(`azurestorageblob:///${containerName}/${blobPath ?? ""}?storageAccountId=${storageAccountId}`);
    }

    private getStorageAccountId(uri: vscode.Uri): string | null {
        const params = new URLSearchParams(uri.query);
        const storageAccountId = params.get("storageAccountId");
        return storageAccountId;
    }

    private getContainerName(uri: vscode.Uri): string {
        const match: RegExpMatchArray | null = uri.path.match(/^\/(?<container>[^\/]*)\/?/);
        return match?.groups ? match.groups.container : '';
    }

    private getBlobPath(uri: vscode.Uri): string {
        const pathWithoutContainer = uri.path.replace("/" + this.getContainerName(uri), "");
        return pathWithoutContainer.startsWith("/") ? pathWithoutContainer.slice(1) : pathWithoutContainer;
    }

    private parseUri(uri: vscode.Uri): { storageAccountId: string, containerName: string, blobPath: string, parentDirPath: string, baseName: string } {
        const storageAccountId = this.getStorageAccountId(uri);
        const containerName = this.getContainerName(uri);
        const blobPath = this.getBlobPath(uri);

        const parentDirPath = BlobPathUtils.dirname(blobPath);
        const baseName = BlobPathUtils.basename(blobPath);

        const result = {
            storageAccountId: storageAccountId ?? "",
            containerName,
            blobPath,
            parentDirPath,
            baseName,
        };
        return result;
    }

    /**
     * @todo Support Azure AD authorization.
     */
    private async getStorageAccount(uri: vscode.Uri, context: IActionContext): Promise<{ storageAccount: StorageAccount, accountKey?: string }> {
        const { storageAccountId } = this.parseUri(uri);
        const subscriptionId = parseAzureResourceId(storageAccountId).subscriptionId;
        const resourceGroupName = parseAzureResourceId(storageAccountId).resourceGroup;
        const storageAccountName = parseAzureResourceId(storageAccountId).resourceName;

        const azureAccountApi = await this.getAzureAccountExtensionApi();
        const accountSubscription = azureAccountApi.subscriptions.find(s => s.subscription.subscriptionId === subscriptionId);
        if (!accountSubscription) {
            throw new Error(`Could not find subscription with ID "${subscriptionId}"`);
        }

        const subscription = this.createAzureSubscription(accountSubscription);
        const client = await createStorageClient([context, createSubscriptionContext(subscription)]);

        const keyResult = await client.storageAccounts.listKeys(resourceGroupName, storageAccountName);
        const keys = (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
        const primaryKey = keys.find(key => {
            return key.keyName === "key1" || key.keyName === "primaryKey";
        });

        const storageAccount = await client.storageAccounts.getProperties(resourceGroupName, storageAccountName);

        return { storageAccount, accountKey: primaryKey?.value };
    }

    private async getBlobClients(uri: vscode.Uri, storageAccount: StorageAccount, accountKey?: string): Promise<{ containerClient: ContainerClient, blobClient: BlobClient }> {
        const { containerName, blobPath } = this.parseUri(uri);

        const blobEndpoint = storageAccount.primaryEndpoints?.blob;
        if (blobEndpoint === undefined) {
            throw Error("Unable to get blob endpoint.");
        }

        let credential: StorageSharedKeyCredential;
        if (accountKey !== undefined) {
            credential = new StorageSharedKeyCredential(storageAccount.name as string, accountKey);
        } else {
            throw Error("Unable to get key credential.");
        }

        const serviceClient = new BlobServiceClient(blobEndpoint, credential);
        const containerClient = serviceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobPath);

        return { containerClient, blobClient };
    }

    private async getDataLakeClients(uri: vscode.Uri, storageAccount: StorageAccount, accountKey?: string): Promise<{ fileSystemClient: DataLakeFileSystemClient, pathClient: DataLakePathClient }> {
        const { containerName, blobPath } = this.parseUri(uri);

        const dfsEndpoint = storageAccount.primaryEndpoints?.dfs;
        if (dfsEndpoint === undefined) {
            throw Error("Unable to get dfs endpoint.");
        }

        let credential: StorageSharedKeyCredentialDataLake;
        if (accountKey !== undefined) {
            credential = new StorageSharedKeyCredentialDataLake(storageAccount.name as string, accountKey);
        } else {
            throw Error("Unable to get key credential.");
        }

        const serviceClient = new DataLakeServiceClient(dfsEndpoint, credential);
        const fileSystemClient = serviceClient.getFileSystemClient(containerName);

        const pathUrl = new URL(dfsEndpoint);
        pathUrl.pathname = `${containerName}/${blobPath}`;
        const pathClient = new DataLakePathClient(pathUrl.toString(), credential);

        return { fileSystemClient, pathClient };
    }

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        return new vscode.Disposable(() => {
            // Since we're not actually watching "in Azure" (i.e. polling for changes), there's no need to selectively watch based on the Uri passed in here. Thus there's nothing to dispose
        });
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        console.log("[DEBUG] stats", uri);
        // When expanding a directory, VSCode always calls the `stats` method to make sure the directory exists and is really a directory.
        // Since directories are virtual in a flat namespace blob container, we always assume the directory exists if a matching blob doesn't exist.
        const result = await callWithTelemetryAndErrorHandling<vscode.FileStat | void>('azureStorage.stat', async (context) => {
            context.errorHandling.rethrow = true;

            const { blobPath } = this.parseUri(uri);

            if (blobPath === "") {
                // The root of the container always exists as a directory.
                return {
                    ctime: 0,
                    mtime: 0,
                    size: 0,
                    type: vscode.FileType.Directory
                };
            } else {
                const { storageAccount, accountKey } = await this.getStorageAccount(uri, context);
                const isHnsEnabled = !!storageAccount.isHnsEnabled;
                const { containerClient, blobClient } = await this.getBlobClients(uri, storageAccount, accountKey);
                if (!isHnsEnabled) {
                    try {
                        // Attempt to get the blob properties. If it succeeds, it's a file.
                        const properties = await blobClient.getProperties();
                        return {
                            ctime: properties.createdOn?.getTime() ?? 0,
                            mtime: properties.lastModified?.getTime() ?? 0,
                            size: properties.contentLength ?? 0,
                            type: vscode.FileType.File
                        };
                    } catch (error) {
                        const pe = parseError(error);
                        if (pe.errorType === "404") {
                            // If the blob doesn't exist, it might be a virtual directory.
                            const prefix = BlobPathUtils.appendSlash(blobPath);
                            let continuationToken: string | undefined = undefined;
                            let hasBlobs = false;
                            do {
                                // Occasionally the server returns 0 blobs and a non-empty continuation token.
                                const listResult = await containerClient.listBlobsFlat({ prefix }).byPage({ maxPageSize: 5 }).next();
                                const response = listResult.value as ListBlobsFlatSegmentResponse;
                                hasBlobs = response.segment.blobItems.length > 0;
                                continuationToken = response.continuationToken;
                            } while (!hasBlobs && !!continuationToken);
                            if (hasBlobs) {
                                return {
                                    ctime: 0,
                                    mtime: 0,
                                    size: 0,
                                    type: vscode.FileType.Directory
                                };
                            }
                            throw vscode.FileSystemError.FileNotFound(uri);
                        }
                        return undefined;
                    }
                } else {
                    try {
                        const properties = await blobClient.getProperties();
                        const isDirectory = properties.metadata?.["hdi_isfolder"] === "true";
                        return {
                            ctime: properties.createdOn?.getTime() ?? 0,
                            mtime: properties.lastModified?.getTime() ?? 0,
                            size: properties.contentLength ?? 0,
                            type: isDirectory ? vscode.FileType.Directory : vscode.FileType.File
                        };
                    } catch (error) {
                        const pe = parseError(error);
                        if (pe.errorType === "404") {
                            throw vscode.FileSystemError.FileNotFound(uri);
                        } else if (pe.errorType === "403") {
                            throw vscode.FileSystemError.NoPermissions(uri);
                        }
                        throw error;
                    }
                }
            }
        });

        console.log("[DEBUG] stats", result);

        return result ?? {
            ctime: 0,
            mtime: 0,
            size: 0,
            type: vscode.FileType.Unknown
        };
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        console.log("[DEBUG] readDirectory", uri);
        // VSCode issues multiple readDirectory calls to get each directory in the path,
        // It results in multiple notifications showing up at the same time. Any way to suppress them?
        const { containerName, blobPath } = this.parseUri(uri);

        const result = await callWithTelemetryAndErrorHandling<[string, vscode.FileType][]>("azureStorage.readDirectory", async (context) => {
            const { storageAccount, accountKey } = await this.getStorageAccount(uri, context);
            const { containerClient } = await this.getBlobClients(uri, storageAccount, accountKey);

            const directoryLabel = blobPath === "" ? containerName : containerName + "/" + blobPath;
            // @todo: localize
            const loadingMessage: string = localize("loadingDir", 'Loading directory "{0}".', directoryLabel);

            const results: [string, vscode.FileType][] = [];

            let continuationToken: string | undefined = undefined;
            const resultsPromise = vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, cancellationToken) => {
                do {
                    progress.report({ message: loadingMessage });
                    const prefix = blobPath === "" ? blobPath : BlobPathUtils.appendSlash(blobPath)
                    const listResult = containerClient.listBlobsByHierarchy("/", {
                        prefix: prefix,
                    }).byPage({ maxPageSize: BlobContainerFS.listBlobPageSize, continuationToken });

                    const response = ((await listResult.next()).value as ListBlobsHierarchySegmentResponse);

                    response.segment.blobItems.forEach(childBlob => results.push([BlobPathUtils.basename(childBlob.name), vscode.FileType.File]));
                    response.segment.blobPrefixes?.forEach(directory => results.push([BlobPathUtils.basename(directory.name), vscode.FileType.Directory]));
                    continuationToken = response.continuationToken;

                    if (cancellationToken.isCancellationRequested || !continuationToken) {
                        return results;
                    }
                } while (true);
            });

            return resultsPromise;
        });

        return result ?? [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        console.log("[DEBUG] createDirectory", uri);
        const result = await callWithTelemetryAndErrorHandling<void>("azureStorage.createDirectory", async (context) => {
            const { storageAccount, accountKey } = await this.getStorageAccount(uri, context);
            const isHnsEnabled = !!storageAccount.isHnsEnabled;

            if (!isHnsEnabled) {
                // Virtual directories don't need to be created
                return;
            } else {
                const { pathClient } = await this.getDataLakeClients(uri, storageAccount, accountKey);
                const directoryClient = pathClient.toDirectoryClient();
                const exists = await directoryClient.exists();
                if (exists) {
                    throw vscode.FileSystemError.FileExists(uri);
                } else {
                    try {
                        await directoryClient.create();
                    } catch (error) {
                        const pe = parseError(error);
                        if (pe.errorType === "404") {
                            throw vscode.FileSystemError.FileNotFound(uri);
                        } else if (pe.errorType === "403") {
                            throw vscode.FileSystemError.NoPermissions(uri);
                        }
                    }
                }
            }
        });

        return result;
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        console.log("[DEBUG] readFile", uri);
        const result = await callWithTelemetryAndErrorHandling('azureStorage.readFile', async (context) => {
            try {
                const { storageAccount, accountKey } = await this.getStorageAccount(uri, context);
                const { blobClient } = await this.getBlobClients(uri, storageAccount, accountKey);

                const buffer = await blobClient.downloadToBuffer();
                return buffer;
            } catch (error) {
                const pe = parseError(error);
                if (pe.errorType === "404") {
                    throw vscode.FileSystemError.FileNotFound(uri);
                } else if (pe.errorType === "403") {
                    throw vscode.FileSystemError.NoPermissions(uri);
                }
                throw error;
            }
        });

        return result ?? Buffer.from("");
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        console.log("[DEBUG] writeFile", uri, options);
        const result = await callWithTelemetryAndErrorHandling("azureStorage.writeFile", async (context) => {
            const { storageAccount, accountKey } = await this.getStorageAccount(uri, context);
            const { blobClient } = await this.getBlobClients(uri, storageAccount, accountKey);

            const exists = await blobClient.exists();
            if (!options.create && !exists) {
                throw vscode.FileSystemError.FileNotFound(uri);
            } else if (options.create && !options.overwrite && exists) {
                throw vscode.FileSystemError.FileExists(uri);
            }

            try {
                await blobClient.getBlockBlobClient().uploadData(content, {
                    blobHTTPHeaders: {
                        blobContentType: mime.getType(uri.path) || undefined
                    }
                });
            } catch (error) {
                const pe = parseError(error);
                if (pe.errorType === "404") {
                    throw vscode.FileSystemError.FileNotFound(uri);
                } else if (pe.errorType === "403") {
                    throw vscode.FileSystemError.NoPermissions(uri);
                }
                throw error;
            }
        });

        return result;
    }

    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        const result = await callWithTelemetryAndErrorHandling<void>("azureStorage.delete", async (context) => {
            if (!options.recursive) {
                throw new Error("Azure storage does not support non-recursive deletion.");
            }

            const { storageAccount, accountKey } = await this.getStorageAccount(uri, context);
            const isHnsEnabled = !!storageAccount.isHnsEnabled;

            try {
                if (!isHnsEnabled) {
                    const { containerClient, blobClient } = await this.getBlobClients(uri, storageAccount, accountKey);
                    const exists = await blobClient.exists();
                    if (exists) {
                        // Check if there is matching blob and delete it.
                        await blobClient.delete();
                    } else {
                        // Check if there is a matching virtual directory and delete its contents
                        const { containerName, blobPath } = this.parseUri(uri);

                        const deletingMessage = `Deleting virtual directory ${containerName}/${blobPath}. (loc)`;
                        let continuationToken: string | undefined = undefined;
                        return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, cancellable: true }, async (progress, cancellationToken) => {
                            do {
                                progress.report({ message: deletingMessage });
                                const prefix = BlobPathUtils.appendSlash(blobPath)
                                const listResult = containerClient.listBlobsFlat({
                                    prefix: prefix,
                                }).byPage({ maxPageSize: BlobContainerFS.listBlobPageSize, continuationToken });

                                const response = ((await listResult.next()).value as ListBlobsFlatSegmentResponse);

                                const deletePromiseBatch = response.segment.blobItems.map((childBlob) => {
                                    return containerClient.getBlobClient(childBlob.name).deleteIfExists();
                                });
                                continuationToken = response.continuationToken;

                                await Promise.allSettled(deletePromiseBatch);
                                if (cancellationToken.isCancellationRequested || !continuationToken) {
                                    return;
                                }
                            } while (true);
                        });
                    }
                } else {
                    const { pathClient } = await this.getDataLakeClients(uri, storageAccount, accountKey);
                    await pathClient.deleteIfExists();
                }
            } catch (error) {
                const pe = parseError(error);
                if (pe.errorType === "403") {
                    throw vscode.FileSystemError.NoPermissions(uri);
                }
                throw error;
            }
        });

        return result;
    }
    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
        const result = await callWithTelemetryAndErrorHandling("azureStorage.rename", async (context) => {
            const { storageAccount, accountKey } = await this.getStorageAccount(oldUri, context);
            const isHnsEnabled = !!storageAccount.isHnsEnabled;
            if (!isHnsEnabled) {
                throw new vscode.FileSystemError("Rename is not supported in a flat namespace storage account. (loc)");
            } else {
                if (options.overwrite) {
                    const { pathClient } = await this.getDataLakeClients(newUri, storageAccount, accountKey);
                    const exists = await pathClient.exists();
                    if (exists) {
                        throw vscode.FileSystemError.FileExists(newUri);
                    }
                }

                const { pathClient } = await this.getDataLakeClients(oldUri, storageAccount, accountKey);
                const { blobPath } = this.parseUri(newUri);

                try {
                    await pathClient.move(blobPath);
                } catch (error) {
                    const pe = parseError(error);
                    if (pe.errorType === "404") {
                        // If old uri or any parent of the new uri doesn't exist, the service will return an 404 error.
                        throw vscode.FileSystemError.FileNotFound(newUri);
                    } else if (pe.errorType === "403") {
                        throw vscode.FileSystemError.NoPermissions(newUri);
                    }
                    throw error;
                }
            }
        });

        return result;
    }

    private azureAccountApi: AzureAccountExtensionApi | undefined;

    private async getAzureAccountExtensionApi(): Promise<AzureAccountExtensionApi> {
        if (!this.azureAccountApi) {
            const extension = vscode.extensions.getExtension<apiUtils.AzureExtensionApiProvider>('ms-vscode.azure-account');

            if (extension) {
                if (!extension.isActive) {
                    await extension.activate();
                }

                if ('getApi' in extension.exports) {
                    this.azureAccountApi = extension.exports.getApi<AzureAccountExtensionApi>('1');
                } else {
                    // support versions of the Azure Account extension <0.10.0
                    this.azureAccountApi = extension.exports as unknown as AzureAccountExtensionApi;
                }

                if (this.azureAccountApi) {
                    await this.azureAccountApi.waitForSubscriptions();
                }
            }
        }

        if (!this.azureAccountApi) {
            throw new Error('Could not get Azure Account API');
        }

        return this.azureAccountApi;
    }

    private createAzureSubscription(subscription: AzureAccountSubscription): AzureSubscription {
        return {
            authentication: {
                getSession: async scopes => {
                    const token = await subscription.session.credentials2.getToken(scopes ?? []);

                    if (!token) {
                        return undefined;
                    }

                    return {
                        accessToken: token.token,
                        account: {
                            id: subscription.session.userId,
                            label: subscription.session.userId
                        },
                        id: 'microsoft',
                        scopes: scopes ?? []
                    };
                }
            },
            name: subscription.subscription.displayName || 'TODO: ever undefined?',
            environment: subscription.session.environment,
            isCustomCloud: subscription.session.environment.name === 'AzureCustomCloud',
            subscriptionId: subscription.subscription.subscriptionId || 'TODO: ever undefined?',
            tenantId: subscription.session.tenantId
        };
    }
}
