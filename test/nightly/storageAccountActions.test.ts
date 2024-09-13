/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BlobContainer, StorageAccount } from '@azure/arm-storage';
import * as azureDataTables from '@azure/data-tables';
import * as azureStorageBlob from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as azureStorageQueue from '@azure/storage-queue';
import { runWithTestActionContext } from '@microsoft/vscode-azext-dev';
import * as assert from 'assert';
import * as vscode from 'vscode';
import { copyConnectionString, copyPrimaryKey, createBlobContainer, createFileShare, createQueue, createStorageAccount, createStorageAccountAdvanced, createTable, deleteBlobContainer, deleteFileShare, deleteQueue, deleteStorageAccount, deleteTable, DialogResponses, getRandomHexString } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';
import { webSiteClient as client, resourceGroupsToDelete } from './global.resource.test';

// eslint-disable-next-line @typescript-eslint/no-misused-promises
suite('Storage Account Actions', function (this: Mocha.Suite): void {
    this.timeout(5 * 60 * 1000);
    let blobUrl: string;
    let fileUrl: string;
    let containerName: string;
    let shareName: string;
    let queueName: string;
    let tableName: string;
    let attachedRegex: RegExp;
    let resourceName: string;

    suiteSetup(function (this: Mocha.Context): void {
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
        await runWithTestActionContext('createGpv2Account', async context => {
            await context.ui.runWithInputs([resourceName], async () => {
                await createStorageAccount(context);
            });
        });
        const createdAccount: StorageAccount = await client.storageAccounts.getProperties(resourceName, resourceName);
        assert.ok(createdAccount);
    });

    test("createStorageAccountAdvanced", async () => {
        const accountNameAdvanced: string = getRandomHexString().toLowerCase();
        const resourceNameAdvanced: string = getRandomHexString().toLowerCase();
        resourceGroupsToDelete.push(resourceNameAdvanced);
        await runWithTestActionContext('createGpv2AccountAdvanced', async context => {
            await context.ui.runWithInputs([accountNameAdvanced, '$(plus) Create new resource group', resourceNameAdvanced, 'Yes', 'index.html', 'index.html', 'East US'], async () => {
                await createStorageAccountAdvanced(context);
            });
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
        await runWithTestActionContext('createBlobContainer', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, containerName], async () => {
                await createBlobContainer(context);
            });
        });
        const createdContainer: BlobContainer = await client.blobContainers.get(resourceName, resourceName, containerName);
        assert.ok(createdContainer);
    });

    test("deleteBlobContainer", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('deleteBlobContainer', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, containerName, DialogResponses.deleteResponse.title], async () => {
                await deleteBlobContainer(context);
            });
        });
        const primaryKey: string = await getPrimaryKey();
        const credential = new azureStorageBlob.StorageSharedKeyCredential(resourceName, primaryKey);
        const blobServiceClient = new azureStorageBlob.BlobServiceClient(blobUrl, credential);
        const containerClient: azureStorageBlob.ContainerClient = blobServiceClient.getContainerClient(containerName);
        assert.ok(!(await containerClient.exists()));
    });

    test("copyConnectionString and createFileShare", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('createFileShare', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, shareName, '5120'], async () => {
                await createFileShare(context);
            });
        });
        const shareClient: azureStorageShare.ShareClient = await createShareClient(resourceName, shareName);
        const shareExists: boolean = await doesShareExist(shareClient);
        assert.ok(shareExists);
    });

    test("deleteFileShare", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('deleteFileShare', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, shareName, DialogResponses.deleteResponse.title], async () => {
                await deleteFileShare(context);
            });
        });
        const shareClient: azureStorageShare.ShareClient = await createShareClient(resourceName, shareName);
        const shareExists: boolean = await doesShareExist(shareClient);
        assert.ok(!shareExists);
    });

    test("createQueue", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('createQueue', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, queueName], async () => {
                await createQueue(context);
            });
        });
        const connectionString: string = await getConnectionString(resourceName);
        const queueClient = new azureStorageQueue.QueueClient(connectionString, queueName);
        assert.ok(await queueClient.exists());
    });

    test("deleteQueue", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('deleteQueue', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, queueName, DialogResponses.deleteResponse.title], async () => {
                await deleteQueue(context);
            });
        });
        const connectionString: string = await getConnectionString(resourceName);
        const queueClient = new azureStorageQueue.QueueClient(connectionString, queueName);
        assert.ok(!(await queueClient.exists()));
    });

    test("createTable", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('createTable', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, tableName], async () => {
                await createTable(context);
            });
        });
        const connectionString: string = await getConnectionString(resourceName);
        const tableClient = azureDataTables.TableClient.fromConnectionString(connectionString, tableName);
        assert.ok(await doesTableExist(tableClient));
    });

    test("deleteTable", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('deleteTable', async context => {
            await context.ui.runWithInputs([attachedRegex, resourceName, tableName, DialogResponses.deleteResponse.title], async () => {
                await deleteTable(context);
            });
        });
        const connectionString: string = await getConnectionString(resourceName);
        const tableClient = azureDataTables.TableClient.fromConnectionString(connectionString, tableName);
        assert.ok(!(await doesTableExist(tableClient)));
    });

    test("deleteStorageAccount", async () => {
        await validateAccountExists(resourceName, resourceName);
        await runWithTestActionContext('deleteStorageAccount', async context => {
            await context.ui.runWithInputs([resourceName, DialogResponses.deleteResponse.title], async () => {
                await deleteStorageAccount(context);
            });
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
        await runWithTestActionContext('copyPrimaryKey', async context => {
            await context.ui.runWithInputs([resourceName], async () => {
                await copyPrimaryKey(context);
            });
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

// Validate the storage account exists or not based on its resource group name and account name
async function validateAccountExists(resourceGroupName: string, accountName: string): Promise<void> {
    const createdAccount: StorageAccount = await client.storageAccounts.getProperties(resourceGroupName, accountName);
    assert.ok(createdAccount);
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

async function doesTableExist(tableClient: azureDataTables.TableClient): Promise<boolean> {
    try {
        await tableClient.getAccessPolicy();
        return true;
    } catch {
        return false;
    }
}

// get the connection string of a storage account by the command azureStorage.copyConnectionString
async function getConnectionString(storageAccountName: string): Promise<string> {
    await vscode.env.clipboard.writeText('');
    await runWithTestActionContext('copyConnectionString', async context => {
        await context.ui.runWithInputs([storageAccountName], async () => {
            await copyConnectionString(context);
        });
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
