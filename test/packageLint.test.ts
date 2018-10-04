/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { addPackageLintSuites } from 'vscode-azureextensiondev';
import { ext } from '../src/extensionVariables';

suite('package lint', async () => {
    let pkgContents = await fse.readJson('../../package.json'); // Relative to 'out/test'
    let pkg: {} = JSON.parse(pkgContents.toString());

    addPackageLintSuites(
        () => ext.context,
        async () => await vscode.commands.getCommands(),
        pkg,
        {
            commandsRegisteredButNotInPackage: [
                'azureStorage.editBlob',
                'azureStorage.editFile',
                'azureStorage.loadMore'
            ]
        });
});
