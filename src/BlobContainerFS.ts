/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { StorageAccountKey } from '@azure/arm-storage';
import { BlobServiceClient, ListBlobsHierarchySegmentResponse, StorageSharedKeyCredential } from '@azure/storage-blob';
import { parseAzureResourceId } from '@microsoft/vscode-azext-azureutils';
import { apiUtils, callWithTelemetryAndErrorHandling, createSubscriptionContext, nonNullProp } from '@microsoft/vscode-azext-utils';
import { AzureSubscription } from '@microsoft/vscode-azureresources-api';
import { posix } from 'path';
import { URLSearchParams } from 'url';
import * as vscode from 'vscode';
import { AzureAccountExtensionApi, AzureSubscription as AzureAccountSubscription } from './azure-account-api';
import { createStorageClient } from './utils/azureClients';
import { StorageAccountKeyWrapper } from './utils/storageWrappers';
import path = require('path');

export class BlobContainerFS implements vscode.FileSystemProvider {

    private _onDidChangeFileEmitter: vscode.EventEmitter<vscode.FileChangeEvent[]> = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFileEmitter.event;

    // Uri: azurestorageblob://<storage account id>?name=<blob name>?path=<path>

    private getRootName(uri: vscode.Uri): string {
        const match: RegExpMatchArray | null = uri.path.match(/^\/[^\/]*\/?/);
        return match ? match[0] : '';
    }

    private parseUri(uri: vscode.Uri) {
        // get name from query
        const params = new Proxy(new URLSearchParams(uri.query), {
            get: (searchParams, prop) => searchParams.get(prop.toString()),
        }) as unknown as { name: string, path?: string, resourceId: string };

        const storageAccountId = params.resourceId;
        const rootName = this.getRootName(uri);
        const filePath: string = uri.path.replace(rootName, '');
        let parentDirPath = path.dirname(filePath);
        parentDirPath = parentDirPath === '.' ? '' : parentDirPath;
        const baseName = path.basename(filePath);

        const result = { storageAccountId, blobName: params.name, path: params.path || '', parentDirPath, baseName, fsPath: filePath };
        console.log('parseUri', result);
        return result;
    }

    private async getSubscription(storageAccountId: string): Promise<AzureSubscription> {
        const subscriptionId = parseAzureResourceId(storageAccountId).subscriptionId;
        const azureAccountApi = await this.getAzureAccountExtensionApi();
        const subscription = azureAccountApi.subscriptions.find(s => s.subscription.subscriptionId === subscriptionId);
        if (!subscription) {
            throw new Error(`Could not find subscription with ID "${subscriptionId}"`);
        }

        return this.createAzureSubscription(subscription);
    }

    watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        return new vscode.Disposable(() => {
            // Since we're not actually watching "in Azure" (i.e. polling for changes), there's no need to selectively watch based on the Uri passed in here. Thus there's nothing to dispose
        });
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {

        const { storageAccountId, blobName } = this.parseUri(uri);

        const result = await callWithTelemetryAndErrorHandling<vscode.FileStat>('azureStorage.stat', async (context) => {
            const subscription = await this.getSubscription(storageAccountId);
            const client = await createStorageClient([context, createSubscriptionContext(subscription)]);

            const resourceGroupName = parseAzureResourceId(storageAccountId).resourceGroup;
            const storageAccountName = parseAzureResourceId(storageAccountId).resourceName;

            const keyResult = await client.storageAccounts.listKeys(resourceGroupName, storageAccountName);
            const keys = (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
            const primaryKey = keys.find(key => {
                return key.keyName === "key1" || key.keyName === "primaryKey";
            });

            if (!primaryKey) {
                throw new Error("Could not find primary key for storage account.");
            }

            const storageAccount = await client.storageAccounts.getProperties(resourceGroupName, storageAccountName);

            const credential = new StorageSharedKeyCredential(storageAccountName, primaryKey.value);
            const blobClient = new BlobServiceClient(nonNullProp(storageAccount.primaryEndpoints!, 'blob'), credential);
            const containerClient = blobClient.getContainerClient(blobName);

            return {
                ctime: 0,
                mtime: 0,
                size: 0,
                type: vscode.FileType.Directory
            }
        });

        return result ?? {
            ctime: 0,
            mtime: 0,
            size: 0,
            type: vscode.FileType.File
        };
    }
    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const { storageAccountId, blobName, parentDirPath, baseName, fsPath } = this.parseUri(uri);
        console.log(`readdir: parentDirPath: ${parentDirPath}, basename: ${baseName}, fsPath: ${uri.fsPath}`);

        const result = await callWithTelemetryAndErrorHandling<[string, vscode.FileType][]>('azureStorage.stat', async (context) => {

            const subscription = await this.getSubscription(storageAccountId);
            const client = await createStorageClient([context, createSubscriptionContext(subscription)]);

            const resourceGroupName = parseAzureResourceId(storageAccountId).resourceGroup;
            const storageAccountName = parseAzureResourceId(storageAccountId).resourceName;

            const keyResult = await client.storageAccounts.listKeys(resourceGroupName, storageAccountName);
            const keys = (keyResult.keys || <StorageAccountKey[]>[]).map(key => new StorageAccountKeyWrapper(key));
            const primaryKey = keys.find(key => {
                return key.keyName === "key1" || key.keyName === "primaryKey";
            });

            if (!primaryKey) {
                throw new Error("Could not find primary key for storage account.");
            }

            const storageAccount = await client.storageAccounts.getProperties(resourceGroupName, storageAccountName);

            const credential = new StorageSharedKeyCredential(storageAccountName, primaryKey.value);
            const blobClient = new BlobServiceClient(nonNullProp(storageAccount.primaryEndpoints!, 'blob'), credential);
            const containerClient = blobClient.getContainerClient(blobName);

            const childBlobs = containerClient.listBlobsByHierarchy(posix.sep, {
                prefix: fsPath,
            }).byPage({ maxPageSize: 100 });

            const response = ((await childBlobs.next()).value as ListBlobsHierarchySegmentResponse).segment;

            const results: [string, vscode.FileType][] = [];
            response.blobItems.forEach(childBlob => results.push([childBlob.name, vscode.FileType.File]));
            response.blobPrefixes?.forEach(directory => results.push([directory.name, vscode.FileType.Directory]));
            return results;
        });

        return result ?? [];
    }
    createDirectory(uri: vscode.Uri): void | Thenable<void> {
        const { storageAccountId, blobName, path } = this.parseUri(uri);
        console.log(`stat: ${storageAccountId}, ${blobName}, ${path}`);
        throw new Error('Method not implemented. createDirectory');
    }
    readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
        const { storageAccountId, blobName, path } = this.parseUri(uri);
        console.log(`readfile: ${storageAccountId}, name: ${blobName}, path: ${path}`);
        return Buffer.from('');
    }
    writeFile(uri: vscode.Uri, _content: Uint8Array, _options: { create: boolean; overwrite: boolean; }): void | Thenable<void> {
        const { storageAccountId, blobName, path } = this.parseUri(uri);
        console.log(`stat: ${storageAccountId}, ${blobName}, ${path}`);
        throw new Error('Method not implemented. writeFile');
    }

    delete(_uri: vscode.Uri, _options: { recursive: boolean; }): void | Thenable<void> {
        throw new Error('Method not implemented.');
    }
    rename(_oldUri: vscode.Uri, _newUri: vscode.Uri, _options: { overwrite: boolean; }): void | Thenable<void> {
        throw new Error('Method not implemented.');
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
