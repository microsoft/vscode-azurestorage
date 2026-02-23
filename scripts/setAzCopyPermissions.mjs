/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

console.log('Setting permissions for azcopy executables in', root);

const paths = [
    'node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64',
    'node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64',
    'node_modules/@azure-tools/azcopy-node/node_modules/@azure-tools/azcopy-darwin/dist/bin/azcopy_darwin_amd64',
    'node_modules/@azure-tools/azcopy-node/node_modules/@azure-tools/azcopy-linux/dist/bin/azcopy_linux_amd64',
];

for (const p of paths) {
    const fullPath = path.join(root, p);
    try {
        console.log('BEFORE', execSync(`ls -l ${fullPath}`).toString());
        execSync(`chmod u+x ${fullPath}`);
        console.log('AFTER', execSync(`ls -l ${fullPath}`).toString());
    } catch (error) {
        console.error(`Error setting permissions for ${fullPath}:`, error.message);
    }
}
