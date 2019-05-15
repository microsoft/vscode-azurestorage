/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccountListResult } from 'azure-arm-storage/lib/models';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzureTreeDataProvider, DialogResponses, TestAzureAccount, TestUserInput } from 'vscode-azureextensionui';
import { ext, getRandomHexString, StorageAccountProvider } from '../extension.bundle';
import { longRunningTestsEnabled } from './global.test';

suite('Storage Account Actions', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();
    let storageAccountClient: StorageManagementClient;
    const resourceGroupName: string = getRandomHexString();
    const storageAccountName: string = getRandomHexString().toLowerCase();

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(120 * 1000);
        await testAccount.signIn();
        ext.tree = new AzureTreeDataProvider(StorageAccountProvider, 'azureStorage.loadMore', undefined, testAccount);
        storageAccountClient = getStorageManagementClient(testAccount);
    });

    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }

        const client: ResourceManagementClient = getResourceManagementClient(testAccount);
        for (const resourceGroup of resourceGroupsToDelete) {
            if (await client.resourceGroups.checkExistence(resourceGroup)) {
                console.log(`Deleting resource group "${resourceGroup}"...`);
                await client.resourceGroups.deleteMethod(resourceGroup);
                console.log(`Resource group "${resourceGroup}" deleted.`);
            } else {
                // If the test failed, the resource group might not actually exist
                console.log(`Ignoring resource group "${resourceGroup}" because it does not exist.`);
            }
        }
        ext.tree.dispose();
    });

    test("createStorageAccount", async () => {
        resourceGroupsToDelete.push(resourceGroupName);
        ext.ui = new TestUserInput([storageAccountName, '$(plus) Create new resource group', resourceGroupName, 'East US']);
        await vscode.commands.executeCommand('azureStorage.createGpv2Account');
        const createdAccount: StorageAccountListResult = await storageAccountClient.storageAccounts.listByResourceGroup(resourceGroupName);
        assert.ok(createdAccount);
        assert.equal(createdAccount[0].name, storageAccountName, `The created Storage Account '${createdAccount[0].name}' is not equal to the expected one '${storageAccountName}'.`);
    });

    test("deleteStorageAccount", async () => {
        const createdAccount1: StorageAccountListResult = await storageAccountClient.storageAccounts.listByResourceGroup(resourceGroupName);
        assert.ok(createdAccount1);
        ext.ui = new TestUserInput([storageAccountName, DialogResponses.deleteResponse.title]);
        await vscode.commands.executeCommand('azureStorage.deleteStorageAccount');
        const createdAccount2: StorageAccountListResult = await storageAccountClient.storageAccounts.listByResourceGroup(resourceGroupName);
        assert.equal(createdAccount2.length, 0, `Deleting failed since the storage account ${storageAccountName} still exists`);
    });
});

function getStorageManagementClient(testAccount: TestAzureAccount): StorageManagementClient {
    return new StorageManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}
