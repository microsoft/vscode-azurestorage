/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from '@azure/storage-blob';
import * as azureStorageShare from '@azure/storage-file-share';
import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { StorageManagementClient } from 'azure-arm-storage';
import { BlobContainer, StorageAccount } from 'azure-arm-storage/lib/models';
import { createQueueService, createTableService, QueueService, StorageServiceClient, TableService } from 'azure-storage';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { TestAzureAccount } from 'vscode-azureextensiondev';
import { AzExtTreeDataProvider, AzureAccountTreeItem, createAzureClient, DialogResponses, ext, getRandomHexString } from '../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from './global.test';

// tslint:disable-next-line: max-func-body-length
suite('Storage Account Actions', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount(vscode);
    let client: StorageManagementClient;
    const resourceName: string = getRandomHexString().toLowerCase();
    const blobUrl: string = `https://${resourceName}.blob.core.windows.net`;
    const fileUrl: string = `https://${resourceName}.file.core.windows.net`;
    // Blob container, file share and queue must have lower case name
    const containerName: string = getRandomHexString().toLowerCase();
    const shareName: string = getRandomHexString().toLowerCase();
    const queueName: string = getRandomHexString().toLowerCase();
    // Table name cannot begin with a digit
    const tableName: string = 'f' + `${getRandomHexString()}`;

    // https://stackoverflow.com/questions/406230/regular-expression-to-match-a-line-that-doesnt-contain-a-word
    const attachedRegex: RegExp = /^((?!Attached).)*$/;

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(120 * 1000);
        await testAccount.signIn();

        ext.azureAccountTreeItem = new AzureAccountTreeItem(testAccount);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'azureStorage.loadMore');
        client = createAzureClient(testAccount.getSubscriptionContext(), StorageManagementClient);
    });

    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }

        const resourceClient = createAzureClient(testAccount.getSubscriptionContext(), ResourceManagementClient);
        await Promise.all(resourceGroupsToDelete.map(async resourceGroup => {
            if (await resourceClient.resourceGroups.checkExistence(resourceGroup)) {
                console.log(`Deleting resource group "${resourceGroup}"...`);
                await resourceClient.resourceGroups.deleteMethod(resourceGroup);
                console.log(`Resource group "${resourceGroup}" deleted.`);
            } else {
                // If the test failed, the resource group might not actually exist
                console.log(`Ignoring resource group "${resourceGroup}" because it does not exist.`);
            }
        }));
        ext.azureAccountTreeItem.dispose();
    });

    test("createStorageAccount", async () => {
        resourceGroupsToDelete.push(resourceName);
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

    // get the connection string of a storage account by the command azureStorage.copyConnectionString
    async function getConnectionString(storageAccountName: string): Promise<string> {
        vscode.env.clipboard.writeText('');
        await testUserInput.runWithInputs([storageAccountName], async () => {
            await vscode.commands.executeCommand('azureStorage.copyConnectionString');
        });
        return vscode.env.clipboard.readText();
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
