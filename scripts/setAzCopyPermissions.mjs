/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { chmod, stat } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

console.log('Setting permissions for azcopy executables in', root);

const paths = [
    // Binaries copied into dist/ by esbuild (included in VSIX)
    'dist/node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64',
    'dist/node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64',
    // Original locations in node_modules (for local dev)
    'node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64',
    'node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64',
    'node_modules/@azure-tools/azcopy-node/node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64',
    'node_modules/@azure-tools/azcopy-node/node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64',
];

for (const p of paths) {
    const fullPath = path.join(root, p);
    try {
        const { mode } = await stat(fullPath);
        // Add owner-execute bit (0o100)
        await chmod(fullPath, mode | 0o100);
        console.log(`Set execute permission on ${p}`);
    } catch {
        // File may not exist on this platform; skip silently
    }
}
