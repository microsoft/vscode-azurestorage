/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { StorageManagementClient } from 'azure-arm-storage';
import { BlobContainer, StorageAccount } from 'azure-arm-storage/lib/models';
import { BlobService, createBlobService, createFileService, createQueueService, createTableService, FileService, QueueService, StorageServiceClient, TableService } from 'azure-storage';
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
    // Blob container, file share and queue must have lower case name
    const containerName: string = getRandomHexString().toLowerCase();
    const shareName: string = getRandomHexString().toLowerCase();
    const queueName: string = getRandomHexString().toLowerCase();
    // Table name cannot begin with a digit
    const tableName: string = 'f' + `${getRandomHexString()}`;

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
        await testUserInput.runWithInputs([resourceName, '$(plus) Create new resource group', resourceName, 'East US'], async () => {
            await vscode.commands.executeCommand('azureStorage.createGpv2Account');
        });
        const createdAccount: StorageAccount = await client.storageAccounts.getProperties(resourceName, resourceName);
        assert.ok(createdAccount);
    });

    test("copyPrimaryKey", async () => {
        await validateAccountExists(resourceName, resourceName);
        await vscode.env.clipboard.writeText('');
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('azureStorage.copyPrimaryKey');
        });
        const primaryKey: string = await vscode.env.clipboard.readText();
        const blobService: BlobService = createBlobService(resourceName, primaryKey, `https://${resourceName}.blob.core.windows.net`);
        await validateBlobService(blobService);
    });

    test("createBlobContainer", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([resourceName, containerName], async () => {
            await vscode.commands.executeCommand('azureStorage.createBlobContainer');
        });
        const createdContainer: BlobContainer = await client.blobContainers.get(resourceName, resourceName, containerName);
        assert.ok(createdContainer);
    });

    test("deleteBlobContainer", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([resourceName, containerName, DialogResponses.deleteResponse.title], async () => {
            await vscode.commands.executeCommand('azureStorage.deleteBlobContainer');
        });
        const connectionString: string = await getConnectionString(resourceName);
        const blobService: BlobService = createBlobService(connectionString);
        const createdContainer: BlobService.ContainerResult = await doesResourceExist<BlobService.ContainerResult>(blobService, 'doesContainerExist', containerName);
        assert.ok(!createdContainer.exists);
    });

    test("copyConnectionString and createFileShare", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([resourceName, shareName, '5120'], async () => {
            await vscode.commands.executeCommand('azureStorage.createFileShare');
        });
        const connectionString: string = await getConnectionString(resourceName);
        const fileService: FileService = createFileService(connectionString);
        const createdShare: FileService.ShareResult = await doesResourceExist<FileService.ShareResult>(fileService, 'doesShareExist', shareName);
        assert.ok(createdShare.exists);
    });

    test("createQueue", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([resourceName, queueName], async () => {
            await vscode.commands.executeCommand('azureStorage.createQueue');
        });
        const connectionString: string = await getConnectionString(resourceName);
        const queueService: QueueService = createQueueService(connectionString);
        const createdQueue: QueueService.QueueResult = await doesResourceExist<QueueService.QueueResult>(queueService, 'doesQueueExist', queueName);
        assert.ok(createdQueue.exists);
    });

    test("createTable", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([resourceName, tableName], async () => {
            await vscode.commands.executeCommand('azureStorage.createTable');
        });
        const connectionString: string = await getConnectionString(resourceName);
        const tableService: TableService = createTableService(connectionString);
        const createdTable: TableService.TableResult = await doesResourceExist<TableService.TableResult>(tableService, 'doesTableExist', tableName);
        assert.ok(createdTable.exists);
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

    // validate the blob service by verifying whether or not it creates a blob container
    async function validateBlobService(blobService: BlobService): Promise<void> {
        // Blob contaienr must have lower case name
        const containerName1: string = getRandomHexString().toLowerCase();
        await new Promise((resolve, reject): void => {
            blobService.createContainerIfNotExists(containerName1, (err: Error | undefined) => {
                // tslint:disable-next-line: no-void-expression
                err ? reject(err) : resolve();
            });
        });
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
