/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { addPackageLintSuites } from 'vscode-azureextensiondev';
import { ext } from '../src/extensionVariables';

suite('package lint', () => {
    let pkgContents = <{}>fse.readJsonSync(path.join(__dirname, '../../package.json')); // Relative to 'out/test'

    addPackageLintSuites(
        () => ext.context,
        async () => await vscode.commands.getCommands(),
        pkgContents,
        {
            commandsRegisteredButNotInPackage: [
                'azureStorage.editBlob',
                'azureStorage.editFile',
                'azureStorage.loadMore'
            ]
        });
});
