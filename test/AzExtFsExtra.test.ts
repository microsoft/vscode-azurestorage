/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as os from 'os';
import * as path from 'path';
import { workspace, WorkspaceFolder } from 'vscode';
import { AzExtFsExtra, getRandomHexString } from "../extension.bundle";


suite('AzExtFsExtra', function (this: Mocha.Suite): void {
    let workspacePath: string;
    this.timeout(3 * 60 * 1000);
    suiteSetup(function (this: Mocha.Context): void {
        const workspaceFolders: readonly WorkspaceFolder[] | undefined = workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error("No workspace is open");
        }

        workspacePath = workspaceFolders[0].uri.fsPath;
    });

    test('pathExists', async () => {
        assert.strictEqual(await AzExtFsExtra.pathExists(workspacePath), true);
        assert.strictEqual(await AzExtFsExtra.pathExists('./path/does/not/exist'), false);
    });

    test('ensureDir that does not exist', async () => {
        const fsPath = path.join(os.tmpdir(), `azExtFsExtra${getRandomHexString()}`);
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), false);
        await AzExtFsExtra.ensureDir(fsPath);
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), true);
    });

    test('isDirectory && !isFile', async () => {
        const fsPath = path.join(os.tmpdir(), `azExtFsExtra${getRandomHexString()}`);
        await AzExtFsExtra.ensureDir(fsPath);
        assert.strictEqual(await AzExtFsExtra.isDirectory(fsPath), true);
        assert.strictEqual(await AzExtFsExtra.isFile(fsPath), false);
    });

    test('ensureFile that does not exist but directory does', async () => {
        const fsPath = path.join(os.tmpdir(), `azExtFsExtra${getRandomHexString()}`);
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), false);
        await AzExtFsExtra.ensureDir(fsPath);
        assert.strictEqual(await AzExtFsExtra.pathExists(fsPath), true);

        const filePath = path.join(fsPath, 'file.txt');
        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), false);
        await AzExtFsExtra.ensureFile(filePath);
        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), true);
    });

    test('ensureFile where directory does not exist', async () => {
        const fsPath = path.join(os.tmpdir(), `azExtFsExtra${getRandomHexString()}`);
        const filePath = path.join(fsPath, 'file.txt');

        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), false);
        await AzExtFsExtra.ensureFile(filePath);
        assert.strictEqual(await AzExtFsExtra.pathExists(filePath), true);
    });

    test('isFile && !isDirectory', async () => {
        const fsPath = path.join(os.tmpdir(), `azExtFsExtra${getRandomHexString()}`);
        const filePath = path.join(fsPath, 'file.txt');

        await AzExtFsExtra.ensureFile(filePath);
        assert.strictEqual(await AzExtFsExtra.isFile(filePath), true);
        assert.strictEqual(await AzExtFsExtra.isDirectory(filePath), false);
    });

    test('readFile', async () => {
        const filePath = path.join(workspacePath, 'index.html');
        const fileContents = await AzExtFsExtra.readFile(filePath);

        assert.strictEqual(/Hello World!/.test(fileContents), true);
    });

    test('writeFile', async () => {
        const fsPath = path.join(os.tmpdir(), `azExtFsExtra${getRandomHexString()}`);
        const filePath = path.join(fsPath, 'file.txt');
        const contents = 'writeFileTest';
        await AzExtFsExtra.writeFile(filePath, contents);

        const fileContents = await AzExtFsExtra.readFile(filePath);
        assert.strictEqual(fileContents, contents);
    });
});

