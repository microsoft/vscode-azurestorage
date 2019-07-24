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
import { TestAzureAccount } from 'vscode-azureextensiondev';
import { AzExtTreeDataProvider, AzureAccountTreeItem, createAzureClient, DialogResponses, ext, getRandomHexString } from '../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from './global.test';

suite('Storage Account Actions', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(1200 * 1000);
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount(vscode);
    const resourceName: string = getRandomHexString().toLowerCase();

    suiteSetup(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
        this.timeout(120 * 1000);
        await testAccount.signIn();

        ext.azureAccountTreeItem = new AzureAccountTreeItem(testAccount);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'azureStorage.loadMore');
    });

    suiteTeardown(async function (this: IHookCallbackContext): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }

        const client = createAzureClient(testAccount.getSubscriptionContext(), ResourceManagementClient);
        await Promise.all(resourceGroupsToDelete.map(async resourceGroup => {
            if (await client.resourceGroups.checkExistence(resourceGroup)) {
                console.log(`Deleting resource group "${resourceGroup}"...`);
                await client.resourceGroups.deleteMethod(resourceGroup);
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
        await testUserInput.runWithInputs([resourceName, '$(plus) Create new resource group', resourceName, 'East US', 'test1'], async () => {
            await vscode.commands.executeCommand('azureStorage.createGpv2Account');
        });
        const client = createAzureClient(testAccount.getSubscriptionContext(), StorageManagementClient);
        const createdAccount: StorageAccount = await client.storageAccounts.getProperties(resourceName, resourceName);
        assert.ok(createdAccount);
    });

    test("deleteStorageAccount", async () => {
        const client = createAzureClient(testAccount.getSubscriptionContext(), StorageManagementClient);
        const createdAccount1: StorageAccount = await client.storageAccounts.getProperties(resourceName, resourceName);
        assert.ok(createdAccount1);
        await testUserInput.runWithInputs([resourceName, DialogResponses.deleteResponse.title], async () => {
            await vscode.commands.executeCommand('azureStorage.deleteStorageAccount');
        });
        await assertThrowsAsync(async () => await client.storageAccounts.getProperties(resourceName, resourceName), /Error/);
    });
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
