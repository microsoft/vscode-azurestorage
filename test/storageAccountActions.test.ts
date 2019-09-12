/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { StorageManagementClient } from 'azure-arm-storage';
import { BlobContainer, StorageAccount } from 'azure-arm-storage/lib/models';
import { BlobService, createBlobService } from 'azure-storage';
import * as clipboardy from 'clipboardy';
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

    test("copyConnectionString", async () => {
        await validateAccountExists(resourceName, resourceName);
        clipboardy.writeSync('');
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('azureStorage.copyConnectionString');
        });
        const connectionString: string = clipboardy.readSync();
        const blobService: BlobService = createBlobService(connectionString);
        await validateBlobService(blobService);
    });

    test("copyPrimaryKey", async () => {
        await validateAccountExists(resourceName, resourceName);
        clipboardy.writeSync('');
        await testUserInput.runWithInputs([resourceName], async () => {
            await vscode.commands.executeCommand('azureStorage.copyPrimaryKey');
        });
        const primaryKey: string = clipboardy.readSync();
        const blobService: BlobService = createBlobService(resourceName, primaryKey, `https://${resourceName}.blob.core.windows.net`);
        await validateBlobService(blobService);
    });

    test("createBlobContainer", async () => {
        await validateAccountExists(resourceName, resourceName);
        await testUserInput.runWithInputs([resourceName, resourceName], async () => {
            await vscode.commands.executeCommand('azureStorage.createBlobContainer');
        });
        const createdContainer: BlobContainer = await client.blobContainers.get(resourceName, resourceName, resourceName);
        assert.ok(createdContainer);
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

    // validate the blob service by verifying whether or not it creates a blob container
    async function validateBlobService(blobService: BlobService): Promise<void> {
        // Blob contaienr must have lower case name
        const containerName: string = getRandomHexString().toLowerCase();
        await new Promise((resolve, reject): void => {
            blobService.createContainerIfNotExists(containerName, (err: Error | undefined) => {
                // tslint:disable-next-line: no-void-expression
                err ? reject(err) : resolve();
            });
        });
        const createdContainer: BlobContainer = await client.blobContainers.get(resourceName, resourceName, containerName);
        assert.ok(createdContainer);
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
