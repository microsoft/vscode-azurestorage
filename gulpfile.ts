/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { gulp_installResourceGroups, gulp_webpack } from '@microsoft/vscode-azext-dev';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as gulp from 'gulp';
import * as path from 'path';

async function prepareForWebpack(): Promise<void> {
    const mainJsPath: string = path.join(__dirname, 'main.js');
    let contents: string = fs.readFileSync(mainJsPath).toString();
    contents = contents
        .replace('out/src/extension', 'dist/extension.bundle')
        .replace(', true /* ignoreBundle */', '');
    fs.writeFileSync(mainJsPath, contents);
}

async function cleanReadme(): Promise<void> {
    const readmePath: string = path.join(__dirname, 'README.md');
    let data: string = fs.readFileSync(readmePath).toString();
    data = data.replace(/<!-- region exclude-from-marketplace -->.*?<!-- endregion exclude-from-marketplace -->/gis, '');
    fs.writeFileSync(readmePath, data);
}

async function setAzCopyExePermissions(): Promise<void> {
    cp.exec(`chmod u+x ${path.join(__dirname, 'node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64')}`);
    cp.exec(`chmod u+x ${path.join(__dirname, 'node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64')}`);
}

exports['webpack-dev'] = gulp.series(prepareForWebpack, () => gulp_webpack('development'));
exports['webpack-prod'] = gulp.series(prepareForWebpack, () => gulp_webpack('production'));
exports.preTest = gulp.series(gulp_installResourceGroups);
exports.cleanReadme = cleanReadme;
exports.setAzCopyExePermissions = setAzCopyExePermissions;
