/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient } from '@azure/arm-storage';
import { createTestActionContext, TestAzureAccount } from '@microsoft/vscode-azext-dev';
import * as vscode from 'vscode';
import { AzureAccountTreeItem, createAzureClient, ext } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';

export let testAccount: TestAzureAccount;
export let webSiteClient: StorageManagementClient;
export const resourceGroupsToDelete: string[] = [];

suiteSetup(async function (this: Mocha.Context): Promise<void> {
    this.skip();
    if (longRunningTestsEnabled) {
        this.timeout(2 * 60 * 1000);
        testAccount = new TestAzureAccount(vscode);
        await testAccount.signIn();
        ext.azureAccountTreeItem = new AzureAccountTreeItem(testAccount);
        webSiteClient = createAzureClient([await createTestActionContext(), testAccount.getSubscriptionContext()], StorageManagementClient);
    }
});

suiteTeardown(async function (this: Mocha.Context): Promise<void> {
    if (longRunningTestsEnabled) {
        this.timeout(10 * 60 * 1000);
        // await Promise.all(resourceGroupsToDelete.map(async resource => {
        //     await beginDeleteResourceGroup(resource);
        // }));
        // ext.azureAccountTreeItem.dispose();
    }
});
