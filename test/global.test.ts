/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
// tslint:disable-next-line:no-require-imports
import mocha = require("mocha");
import * as vscode from "vscode";
import { ext } from "../src/extensionVariables";

// Runs before all tests
suiteSetup(async function (this: mocha.IHookCallbackContext): Promise<void> {
    this.timeout(60 * 1000);
    console.log('global.test.ts: suiteSetup');

    console.log("Refreshing tree to make sure extension is activated");
    await vscode.commands.executeCommand('azureStorage.refresh');
    console.log("Refresh done");
    assert(!!<vscode.ExtensionContext | undefined>ext.context, "Extension not activated");
});
