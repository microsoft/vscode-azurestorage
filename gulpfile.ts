/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:no-unsafe-any

import * as cp from 'child_process';
import * as fse from 'fs-extra';
import * as gulp from 'gulp';
import * as eslint from 'gulp-eslint';
import * as gulpIf from 'gulp-if';
import * as path from 'path';
import { gulp_installAzureAccount, gulp_webpack } from 'vscode-azureextensiondev';

async function prepareForWebpack(): Promise<void> {
    const mainJsPath: string = path.join(__dirname, 'main.js');
    let contents: string = (await fse.readFile(mainJsPath)).toString();
    contents = contents
        .replace('out/src/extension', 'dist/extension.bundle')
        .replace(', true /* ignoreBundle */', '');
    await fse.writeFile(mainJsPath, contents);
}

async function cleanReadme(): Promise<void> {
    const readmePath: string = path.join(__dirname, 'README.md');
    let data: string = (await fse.readFile(readmePath)).toString();
    data = data.replace(/<!-- region exclude-from-marketplace -->.*?<!-- endregion exclude-from-marketplace -->/gis, '');
    await fse.writeFile(readmePath, data);
}

async function setAzCopyExePermissions(): Promise<void> {
    if (process.platform === 'darwin') {
        cp.exec(`chmod u+x ${path.join(__dirname, 'node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64')}`);
    } else if (process.platform === 'linux') {
        cp.exec(`chmod u+x ${path.join(__dirname, 'node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64')}`);
    }
}

function lint(): void {
    const fix: boolean = process.argv.slice(2).includes('--fix');
    return gulp.src(['src/**/*.ts'])
        .pipe(eslint({ fix }))
        .pipe(eslint.format())
        .pipe(eslint.failAfterError())
        .pipe(eslint.results(
            results => {
                if (results.warningCount) {
                    throw new Error('ESLint generated warnings.');
                }
            }))
        .pipe(gulpIf(isFixed, gulp.dest('src')));
}

function isFixed(file) {
	return file.eslint != null && file.eslint.fixed;
}

exports['webpack-dev'] = gulp.series(prepareForWebpack, () => gulp_webpack('development'));
exports['webpack-prod'] = gulp.series(prepareForWebpack, () => gulp_webpack('production'));
exports.preTest = gulp_installAzureAccount;
exports.cleanReadme = cleanReadme;
exports.setAzCopyExePermissions = setAzCopyExePermissions;
exports.lint = lint;
