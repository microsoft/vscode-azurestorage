/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzExtTreeDataProvider, DialogResponses, TestAzureAccount, TestUserInput } from 'vscode-azureextensionui';
import { AzureAccountTreeItem, ext, getRandomHexString } from '../extension.bundle';
import { longRunningTestsEnabled } from './global.test';

suite('Storage Account Actions', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();
    let storageAccountClient: StorageManagementClient;
    const resourceName: string = getRandomHexString().toLowerCase();

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(120 * 1000);
        await testAccount.signIn();

        ext.azureAccountTreeItem = new AzureAccountTreeItem(testAccount);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'azureStorage.loadMore');
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
        ext.azureAccountTreeItem.dispose();
    });

    test("createStorageAccount", async () => {
        resourceGroupsToDelete.push(resourceName);
        ext.ui = new TestUserInput([resourceName, '$(plus) Create new resource group', resourceName, 'East US']);
        await vscode.commands.executeCommand('azureStorage.createGpv2Account');
        const createdAccount: StorageAccount = await storageAccountClient.storageAccounts.getProperties(resourceName, resourceName);
        assert.ok(createdAccount);
    });

    test("deleteStorageAccount", async () => {
        const createdAccount1: StorageAccount = await storageAccountClient.storageAccounts.getProperties(resourceName, resourceName);
        assert.ok(createdAccount1);
        ext.ui = new TestUserInput([resourceName, DialogResponses.deleteResponse.title]);
        await vscode.commands.executeCommand('azureStorage.deleteStorageAccount');
        await assertThrowsAsync(async () => await storageAccountClient.storageAccounts.getProperties(resourceName, resourceName), /Error/);
    });
});

function getStorageManagementClient(testAccount: TestAzureAccount): StorageManagementClient {
    return new StorageManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}

async function assertThrowsAsync(fn: { (): Promise<StorageAccount>; (): void; }, regExp: RegExp) {
    let f = () => { };
    try {
        await fn();
    } catch (e) {
        f = () => { throw e };
    } finally {
        assert.throws(f, regExp);
    }
}
