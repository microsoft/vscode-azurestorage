/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// eslint-disable-next-line import/no-internal-modules
import { StorageAccount } from '@azure/arm-storage';
import { HttpOperationResponse, ServiceClient } from '@azure/ms-rest-js';
import { runWithTestActionContext } from '@microsoft/vscode-azext-dev';
import { AzExtTreeItem } from '@microsoft/vscode-azext-utils';
import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { createGenericClient, delay, deployStaticWebsite, ext, getRandomHexString, ResolvedAppResourceTreeItem, ResolvedStorageAccount } from '../../extension.bundle';
import { longRunningTestsEnabled } from '../global.test';
import { resourceGroupsToDelete, webSiteClient } from './global.resource.test';

suite('Deploy', function (this: Mocha.Suite): void {
    this.timeout(3 * 60 * 1000);

    suiteSetup(function (this: Mocha.Context): void {
        if (!longRunningTestsEnabled) {
            this.skip();
        }
    });

    test("deployStaticWebsite", async () => {
        const resourceName: string = getRandomHexString().toLowerCase();
        resourceGroupsToDelete.push(resourceName);
        const testFolderPath: string = getWorkspacePath('html-hello-world');
        await runWithTestActionContext('deployStaticWebsite', async context => {
            await context.ui.runWithInputs([testFolderPath, /create new storage account/i, resourceName], async () => {
                await deployStaticWebsite(context);
            });
            const createdAccount: StorageAccount = await webSiteClient.storageAccounts.getProperties(resourceName, resourceName);
            const webUrl: string | undefined = (<ResolvedAppResourceTreeItem<ResolvedStorageAccount>>await ext.rgApi.tree.findTreeItem<ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtTreeItem>(<string>createdAccount.id, context)).root.primaryEndpoints?.web;
            const client: ServiceClient = await createGenericClient(context, undefined);
            await validateWebSite(webUrl, client, 60 * 1000, 1000);
        });
    })
});

// The workspace folder that vscode is opened against for tests
function getWorkspacePath(testWorkspaceName: string): string {
    let workspacePath: string = '';
    const workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error("No workspace is open");
    } else {
        for (const projectFolder of workspaceFolders) {
            if (projectFolder.name === testWorkspaceName) {
                workspacePath = projectFolder.uri.fsPath;
            }
        }
        assert.strictEqual(path.basename(workspacePath), testWorkspaceName, "Opened against an unexpected workspace.");
        return workspacePath;
    }
}

// Polling to send the request within the maximum time
async function validateWebSite(webUrl: string | undefined, client: ServiceClient, maximumValidationMs: number, pollingMs: number) {
    const endTime: number = Date.now() + maximumValidationMs;
    let response: HttpOperationResponse;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            response = await client.sendRequest({ method: 'GET', url: webUrl });
            if (Date.now() > endTime || response.status === 200) {
                break;
            }
        } catch {
            // Ignore errors. In almost every case, the site isn't enabled yet when we ping it the first few times
        }
        await delay(pollingMs);
    }
    assert.ok(response.bodyAsText && response.bodyAsText.includes('Hello World!'));
}
