/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:no-unsafe-any

import * as fse from 'fs-extra';
import * as gulp from 'gulp';
import * as path from 'path';
import { gulp_installVSCodeExtension, gulp_webpack } from 'vscode-azureextensiondev';

async function prepareForWebpack(): Promise<void> {
    const mainJsPath: string = path.join(__dirname, 'main.js');
    let contents: string = (await fse.readFile(mainJsPath)).toString();
    contents = contents
        .replace('out/src/extension', 'dist/extension.bundle')
        .replace(', true /* ignoreBundle */', '');
    await fse.writeFile(mainJsPath, contents);
}

async function gulp_installInsidersAzureAccount(): Promise<void> {
    return gulp_installVSCodeExtension('ms-vscode', 'azure-account', true);
}

exports['webpack-dev'] = gulp.series(prepareForWebpack, () => gulp_webpack('development'));
exports['webpack-prod'] = gulp.series(prepareForWebpack, () => gulp_webpack('production'));
exports.preTest = gulp_installInsidersAzureAccount;
