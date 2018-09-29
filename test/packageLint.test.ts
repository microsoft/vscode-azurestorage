/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import { packageLint } from 'vscode-azureextensionui';

suite('package lint', async () => {
    let pkgContents = fse.readFileSync(require.resolve('../../package.json')); // Relative to 'out/test'
    let pkg = JSON.parse(pkgContents.toString());

    packageLint(
        pkg,
        {
            commandsRegisteredButNotInPackage: [
                'azureStorage.editBlob',
                'azureStorage.editFile',
                'azureStorage.loadMoreNodes'
            ]
        });
});
