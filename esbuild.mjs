/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { autoEsbuildOrWatch, autoSelectEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
import { copy } from 'esbuild-plugin-copy';

const { extensionConfig, telemetryConfig } = autoSelectEsbuildConfig();

/** @type {import('esbuild').BuildOptions} */
const finalConfig = {
    ...extensionConfig,
    external: [
        ...(extensionConfig.external ?? []),
        // AzCopy platform packages contain native executables and must not be bundled
        '@azure-tools/azcopy-darwin',
        '@azure-tools/azcopy-linux',
        '@azure-tools/azcopy-win32',
        '@azure-tools/azcopy-win64',
    ],
    plugins: [
        ...(extensionConfig.plugins ?? []),
        copy({
            resolveFrom: 'out',
            assets: [
                // Copy azcopy platform packages so they end up in dist/node_modules/ inside the VSIX
                {
                    from: ['./node_modules/@azure-tools/azcopy-darwin/**/*'],
                    to: ['./node_modules/@azure-tools/azcopy-darwin'],
                },
                {
                    from: ['./node_modules/@azure-tools/azcopy-linux/**/*'],
                    to: ['./node_modules/@azure-tools/azcopy-linux'],
                },
                {
                    from: ['./node_modules/@azure-tools/azcopy-win32/**/*'],
                    to: ['./node_modules/@azure-tools/azcopy-win32'],
                },
                {
                    from: ['./node_modules/@azure-tools/azcopy-win64/**/*'],
                    to: ['./node_modules/@azure-tools/azcopy-win64'],
                },
            ],
        }),
    ],
};

await autoEsbuildOrWatch({ extensionConfig: finalConfig, telemetryConfig });
