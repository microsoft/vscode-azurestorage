/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as assert from 'assert';
import { BlobContainer, StorageAccount } from 'azure-arm-storage/lib/models';
import { createQueueService, createTableService, QueueService, StorageServiceClient, TableService } from 'azure-storage';
import * as vscode from 'vscode';
import { DialogResponses, getRandomHexString } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient as client } from './global.resource.test';

// tslint:disable-next-line: max-func-body-length
suite('Storage Account Actions', async function (this: Mocha.Suite): Promise<void> {
    this.timeout(5 * 60 * 1000);
    let blobUrl: string;
    let fileUrl: string;
    let containerName: string;
    let shareName: string;
    let queueName: string;
    let tableName: string;
    let attachedRegex: RegExp;
    let resourceName: string;

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(2 * 60 * 1000);
        resourceName = getRandomHexString().toLowerCase();
        blobUrl = `https://${resourceName}.blob.core.windows.net`;
        fileUrl = `https://${resourceName}.file.core.windows.net`;
        // Blob container, file share and queue must have lower case name
        containerName = getRandomHexString().toLowerCase();
        shareName = getRandomHexString().toLowerCase();
        queueName = getRandomHexString().toLowerCase();
        // Table name cannot begin with a digit
        tableName = 'f' + `${getRandomHexString()}`;

        // https://stackoverflow.com/questions/406230/regular-expression-to-match-a-line-that-doesnt-contain-a-word
        attachedRegex = /^((?!Attached).)*$/;
        resourceGroupsToDelete.push(resourceName);
    });

    test("createStorageAccount", async () => {
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('azureStorage.createGpv2Account');
        });
        const createdAccount: StorageAccount = await client.storageAccounts.getProperties(resourceName, resourceName);
        assert.ok(createdAccount);
    });

    test("createStorageAccountAdvanced", async () => {
        const accountNameAdvanced: string = getRandomHexString().toLowerCase();
        const resourceNameAdvanced: string = getRandomHexString().toLowerCase();
        resourceGroupsToDelete.push(resourceNameAdvanced);
        await testUserInput.runWithInputs([accountNameAdvanced, '$(plus) Create new resource group', resourceNameAdvanced, 'Yes', 'index.html', 'index.html', 'East US'], async () => {
            await vscode.commands.executeCommand('azureStorage.createGpv2AccountAdvanced');
        });
        const createdAccount: StorageAccount = await client.storageAccounts.getProperties(resourceNameAdvanced, accountNameAdvanced);
        assert.ok(createdAccount);
    });

    test("copyPrimaryKey", async () => {
        const primaryKey: string = await getPrimaryKey();
        const credential = new azureStorageBlob.StorageSharedKeyCredential(resourceName, primaryKey);
        const blobServiceClient = new azureStorageBlob.BlobServiceClient(blobUrl, credential);
        await validateBlobService(blobServiceClient);
    });

    test("createBlobContainer", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([attachedRegex, resourceName, containerName], async () => {
            await vscode.commands.executeCommand('azureStorage.createBlobContainer');
        });
        const createdContainer: BlobContainer = await client.blobContainers.get(resourceName, resourceName, containerName);
        assert.ok(createdContainer);
    });

    test("deleteBlobContainer", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([attachedRegex, resourceName, containerName, DialogResponses.deleteResponse.title], async () => {
            await vscode.commands.executeCommand('azureStorage.deleteBlobContainer');
        });
        const primaryKey: string = await getPrimaryKey();
        const credential = new azureStorageBlob.StorageSharedKeyCredential(resourceName, primaryKey);
        const blobServiceClient = new azureStorageBlob.BlobServiceClient(blobUrl, credential);
        const containerClient: azureStorageBlob.ContainerClient = blobServiceClient.getContainerClient(containerName);
        assert.ok(!(await containerClient.exists()));
    });

    test("copyConnectionString and createFileShare", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([attachedRegex, resourceName, shareName, '5120'], async () => {
            await vscode.commands.executeCommand('azureStorage.createFileShare');
        });
        const shareClient: azureStorageShare.ShareClient = await createShareClient(resourceName, shareName);
        const shareExists: boolean = await doesShareExist(shareClient);
        assert.ok(shareExists);
    });

    test("deleteFileShare", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([attachedRegex, resourceName, shareName, DialogResponses.deleteResponse.title], async () => {
            await vscode.commands.executeCommand('azureStorage.deleteFileShare');
        });
        const shareClient: azureStorageShare.ShareClient = await createShareClient(resourceName, shareName);
        const shareExists: boolean = await doesShareExist(shareClient);
        assert.ok(!shareExists);
    });

    test("createQueue", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([attachedRegex, resourceName, queueName], async () => {
            await vscode.commands.executeCommand('azureStorage.createQueue');
        });
        const connectionString: string = await getConnectionString(resourceName);
        const queueService: QueueService = createQueueService(connectionString);
        const createdQueue: QueueService.QueueResult = await doesResourceExist<QueueService.QueueResult>(queueService, 'doesQueueExist', queueName);
        assert.ok(createdQueue.exists);
    });

    test("deleteQueue", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([attachedRegex, resourceName, queueName, DialogResponses.deleteResponse.title], async () => {
            await vscode.commands.executeCommand('azureStorage.deleteQueue');
        });
        const connectionString: string = await getConnectionString(resourceName);
        const queueService: QueueService = createQueueService(connectionString);
        const createdQueue: QueueService.QueueResult = await doesResourceExist<QueueService.QueueResult>(queueService, 'doesQueueExist', queueName);
        assert.ok(!createdQueue.exists);
    });

    test("createTable", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([attachedRegex, resourceName, tableName], async () => {
            await vscode.commands.executeCommand('azureStorage.createTable');
        });
        const connectionString: string = await getConnectionString(resourceName);
        const tableService: TableService = createTableService(connectionString);
        const createdTable: TableService.TableResult = await doesResourceExist<TableService.TableResult>(tableService, 'doesTableExist', tableName);
        assert.ok(createdTable.exists);
    });

    test("deleteTable", async () => {
        await validateAccountExists(resourceName, resourceName);
        const connectionString: string = await getConnectionString(resourceName);
        const tableService: TableService = createTableService(connectionString);
        let createdTable: TableService.TableResult = await doesResourceExist<TableService.TableResult>(tableService, 'doesTableExist', tableName);
        assert.ok(createdTable.exists);
        await testUserInput.runWithInputs([attachedRegex, resourceName, tableName, DialogResponses.deleteResponse.title], async () => {
            await vscode.commands.executeCommand('azureStorage.deleteTable');
        });
        createdTable = await doesResourceExist<TableService.TableResult>(tableService, 'doesTableExist', tableName);
        assert.ok(!createdTable.exists);
    });

    test("deleteStorageAccount", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([resourceName, DialogResponses.deleteResponse.title], async () => {
            await vscode.commands.executeCommand('azureStorage.deleteStorageAccount');
        });
        await assertThrowsAsync(async () => await client.storageAccounts.getProperties(resourceName, resourceName), /Error/);
    });

    // validate the blob service by verifying whether or not it creates a blob container
    async function validateBlobService(blobServiceClient: azureStorageBlob.BlobServiceClient): Promise<void> {
        // Blob container must have lower case name
        const containerName1: string = getRandomHexString().toLowerCase();
        const containerClient: azureStorageBlob.ContainerClient = blobServiceClient.getContainerClient(containerName1);
        if (!(await containerClient.exists())) {
            await containerClient.create();
        }
        const createdContainer: BlobContainer = await client.blobContainers.get(resourceName, resourceName, containerName1);
        assert.ok(createdContainer);
    }

    async function getPrimaryKey(): Promise<string> {
        await validateAccountExists(resourceName, resourceName);
        await vscode.env.clipboard.writeText('');
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('azureStorage.copyPrimaryKey');
        });
        return await vscode.env.clipboard.readText();
    }

    async function createShareClient(newResourceName: string, newShareName: string): Promise<azureStorageShare.ShareClient> {
        const primaryKey: string = await getPrimaryKey();
        const credential = new azureStorageShare.StorageSharedKeyCredential(newResourceName, primaryKey);
        const shareServiceClient: azureStorageShare.ShareServiceClient = new azureStorageShare.ShareServiceClient(fileUrl, credential);
        return shareServiceClient.getShareClient(newShareName);
    }
});

// Validate the storage account exists or not based on its resource group name and account name
async function validateAccountExists(resourceGroupName: string, accountName: string): Promise<void> {
    const createdAccount: StorageAccount = await client.storageAccounts.getProperties(resourceGroupName, accountName);
    assert.ok(createdAccount);
}

// validate the resource exists or not
async function doesResourceExist<T>(service: StorageServiceClient, fn: string, name: string): Promise<T> {
    // tslint:disable-next-line: no-unsafe-any
    return new Promise((resolve, reject) => service[fn](name, (err: Error | undefined, res: T) => {
        if (err) {
            reject(err);
        } else {
            resolve(res);
        }
    }));
}

// validate the file share exists or not
async function doesShareExist(shareClient: azureStorageShare.ShareClient): Promise<boolean> {
    try {
        await shareClient.getProperties();
        return true;
    } catch {
        return false;
    }
}

// get the connection string of a storage account by the command azureStorage.copyConnectionString
async function getConnectionString(storageAccountName: string): Promise<string> {
    vscode.env.clipboard.writeText('');
    await testUserInput.runWithInputs([storageAccountName], async () => {
        await vscode.commands.executeCommand('azureStorage.copyConnectionString');
    });
    return vscode.env.clipboard.readText();
}

async function assertThrowsAsync(fn: { (): Promise<StorageAccount>; (): void; }, regExp: RegExp): Promise<void> {
    let f = () => { return undefined; };
    try {
        await fn();
    } catch (e) {
        f = () => { throw e; };
    } finally {
        assert.throws(f, regExp);
    }
}
