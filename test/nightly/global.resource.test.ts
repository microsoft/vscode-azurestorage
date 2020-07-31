/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from '@azure/arm-resources';
import { StorageManagementClient } from '@azure/arm-storage';
import * as vscode from 'vscode';
import { TestAzureAccount } from 'vscode-azureextensiondev';
import { AzExtTreeDataProvider, AzureAccountTreeItem, createAzureClient, ext } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';

export let testAccount: TestAzureAccount;
export let webSiteClient: StorageManagementClient;
export const resourceGroupsToDelete: string[] = [];

suiteSetup(async function (this: Mocha.Context): Promise<void> {
    if (longRunningTestsEnabled) {
        this.timeout(2 * 60 * 1000);
        testAccount = new TestAzureAccount(vscode);
        await testAccount.signIn();
        ext.azureAccountTreeItem = new AzureAccountTreeItem(testAccount);
        ext.tree = new AzExtTreeDataProvider(ext.azureAccountTreeItem, 'azureStorage.loadMore');
        webSiteClient = createAzureClient(testAccount.getSubscriptionContext(), StorageManagementClient);
    }
});

suiteTeardown(async function (this: Mocha.Context): Promise<void> {
    if (longRunningTestsEnabled) {
        this.timeout(10 * 60 * 1000);
        await Promise.all(resourceGroupsToDelete.map(async resource => {
            await beginDeleteResourceGroup(resource);
        }));
        ext.azureAccountTreeItem.dispose();
    }
});

export async function beginDeleteResourceGroup(resourceGroup: string): Promise<void> {
    const client: ResourceManagementClient = createAzureClient(testAccount.getSubscriptionContext(), ResourceManagementClient);
    if ((await client.resourceGroups.checkExistence(resourceGroup)).body) {
        console.log(`Started delete of resource group "${resourceGroup}"...`);
        await client.resourceGroups.beginDeleteMethod(resourceGroup);
        console.log(`Successfully started delete of resource group "${resourceGroup}".`);
    } else {
        // If the test failed, the resource group might not actually exist
        console.log(`Ignoring resource group "${resourceGroup}" because it does not exist.`);
    }
}
