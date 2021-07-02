/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export const longRunningTestsEnabled: boolean = !/^(false|0)?$/i.test(process.env.ENABLE_LONG_RUNNING_TESTS || '');

// Runs before all tests
suiteSetup(async function (this: Mocha.Context): Promise<void> {
    this.timeout(120 * 1000);
    await vscode.commands.executeCommand('azureStorage.refresh'); // activate the extension before tests begin
});
