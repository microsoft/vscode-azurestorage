/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageAccount } from '@azure/arm-storage/esm/models';
import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { createGenericClient, ext, getRandomHexString, IActionContext, StorageAccountTreeItem } from '../../extension.bundle';
import { longRunningTestsEnabled, testUserInput } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Deploy', async function (this: Mocha.Suite): Promise<void> {
    this.timeout(3 * 60 * 1000);

    suiteSetup(async function (this: Mocha.Context): Promise<void> {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
    });

    test("deployStaticWebsite", async () => {
        const resourceName = getRandomHexString().toLowerCase()
        resourceGroupsToDelete.push(resourceName);
        const context: IActionContext = { telemetry: { properties: {}, measurements: {} }, errorHandling: { issueProperties: {} }, ui: testUserInput, valuesToMask: [] };
        const testFolderPath: string = await getWorkspacePath('testFolder');
        await testUserInput.runWithInputs([testFolderPath, /create new storage account/i, resourceName], async () => {
            await vscode.commands.executeCommand('azureStorage.deployStaticWebsite');
        });
        const createdAccount: StorageAccount = await webSiteClient.storageAccounts.getProperties(resourceName, resourceName);
        const webUrl: string | undefined = (<StorageAccountTreeItem>await ext.tree.findTreeItem(<string>createdAccount.id, context)).root.primaryEndpoints?.web;
        const client: ServiceClient = await createGenericClient();
        const response: HttpOperationResponse = await client.sendRequest({ method: 'GET', url: webUrl });
        assert.strictEqual(response.status, 200);
    })
});

// The workspace folder that vscode is opened against for tests
async function getWorkspacePath(testWorkspaceName: string): Promise<string> {
    let workspacePath: string = '';
    const workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace is open");
    } else {
        for (const obj of workspaceFolders) {
            if (obj.name === testWorkspaceName) {
                workspacePath = obj.uri.fsPath;
            }
        }
        assert.strictEqual(path.basename(workspacePath), testWorkspaceName, "Opened against an unexpected workspace.");
        return workspacePath;
    }
}
