/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Uri, workspace, WorkspaceFolder } from 'vscode';
import { AzExtFsExtra, getRandomHexString } from "../extension.bundle";
import { assertThrowsAsync } from './assertThrowsAsync';


suite('AzExtFsExtra', function (this: Mocha.Suite): void {
    let workspacePath: string;
    let testFolderPath: string;
    let workspaceFilePath: string;

    const indexHtml: string = 'index.html';

    const nonExistingPath: string = ' ./path/does/not/exist';
    const nonExistingFilePath = path.join(nonExistingPath, indexHtml);

    suiteSetup(function (this: Mocha.Context): void {
        testFolderPath = `azExtFsExtra${getRandomHexString()}`
        const workspaceFolders: readonly WorkspaceFolder[] | undefined = workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error("No workspace is open");
        }

        workspacePath = workspaceFolders[0].uri.fsPath;
        workspaceFilePath = path.join(workspacePath, indexHtml);
    });

    test('pathExists for directory', async () => {
        assert.strictEqual(await AzExtFsExtra.pathExists(workspacePath), fs.existsSync(workspacePath));
        assert.strictEqual(await AzExtFsExtra.pathExists(nonExistingPath), fs.existsSync(nonExistingPath));
    });

    test('pathExists for file', async () => {
        assert.strictEqual(await AzExtFsExtra.pathExists(workspaceFilePath), fs.existsSync(workspaceFilePath));
        assert.strictEqual(await AzExtFsExtra.pathExists(nonExistingFilePath), fs.existsSync(nonExistingFilePath));
    });

    test('isDirectory properly detects folders', async () => {
        assert.strictEqual(await AzExtFsExtra.isDirectory(workspacePath), isDirectoryFs(workspacePath));
        assert.strictEqual(await AzExtFsExtra.isDirectory(workspaceFilePath), isDirectoryFs(workspaceFilePath));

    });

    test('isFile properly detects files', async () => {
        assert.strictEqual(await AzExtFsExtra.isFile(workspaceFilePath), isFileFs(workspaceFilePath));
        assert.strictEqual(await AzExtFsExtra.isFile(workspacePath), isFileFs(workspacePath));
    });

    test('ensureDir that does not exist', async () => {
        const fsPath = path.join(os.homedir(), testFolderPath, getRandomHexString());
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), fs.existsSync(fsPath));
        await AzExtFsExtra.ensureDir(fsPath);

        assert.strictEqual(await AzExtFsExtra.isDirectory(fsPath), isDirectoryFs(fsPath));
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), fs.existsSync(fsPath));
    });

    test('ensureDir that exists as a file errors', async () => {
        const fsPath = path.join(os.homedir(), testFolderPath, getRandomHexString());
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), fs.existsSync(fsPath));
        await AzExtFsExtra.ensureFile(fsPath);

        await assertThrowsAsync(async () => await AzExtFsExtra.ensureDir(fsPath), /FileSystemError/);
    });

    test('ensureFile where directory exists', async () => {
        const fsPath = path.join(os.homedir(), testFolderPath, getRandomHexString());

        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), fs.existsSync(fsPath));
        await AzExtFsExtra.ensureDir(fsPath);
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), fs.existsSync(fsPath));

        const filePath = path.join(fsPath, indexHtml);
        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), fs.existsSync(filePath));
        await AzExtFsExtra.ensureFile(filePath);

        assert.strictEqual(await AzExtFsExtra.isFile(filePath), isFileFs(filePath));
        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), fs.existsSync(filePath));
    });

    test('ensureFile where directory does not exist', async () => {
        const fsPath = path.join(os.homedir(), testFolderPath, getRandomHexString());
        const filePath = path.join(fsPath, indexHtml);

        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), fs.existsSync(filePath));
        await AzExtFsExtra.ensureFile(filePath);

        assert.strictEqual(await AzExtFsExtra.isFile(filePath), isFileFs(filePath));
        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), fs.existsSync(filePath));
    });

    test('ensureFile where directory exists with the same name errors', async () => {
        const fsPath = path.join(os.homedir(), testFolderPath, getRandomHexString());
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), fs.existsSync(fsPath));
        await AzExtFsExtra.ensureDir(fsPath);

        await assertThrowsAsync(async () => await AzExtFsExtra.ensureFile(fsPath), /FileSystemError/);
    });

    test('readFile', async () => {
        const fileContents = await AzExtFsExtra.readFile(workspaceFilePath);
        const fsFileContents = fs.readFileSync(workspaceFilePath).toString();

        assert.strictEqual(fileContents, fsFileContents);
    });

    test('writeFile', async () => {
        const fsPath = path.join(os.homedir(), testFolderPath, getRandomHexString());
        const filePath = path.join(fsPath, indexHtml);
        const contents = 'writeFileTest';
        await AzExtFsExtra.writeFile(filePath, contents);

        const fileContents = await AzExtFsExtra.readFile(filePath);
        const fsFileContents = fs.readFileSync(filePath).toString();
        assert.strictEqual(fileContents, fsFileContents);
    });

    suiteTeardown(async function (this: Mocha.Context): Promise<void> {
        await workspace.fs.delete(Uri.file(path.join(os.homedir(), testFolderPath)), { recursive: true })
        console.log(testFolderPath, 'deleted.');
    });
});

function isDirectoryFs(fsPath: string): boolean {
    return fs.statSync(fsPath).isDirectory();
}

function isFileFs(fsPath: string): boolean {
    return fs.statSync(fsPath).isFile();
}

