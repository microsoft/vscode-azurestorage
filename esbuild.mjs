/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { autoEsbuildOrWatch, autoSelectEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
import { copy } from 'esbuild-plugin-copy';
import { cpSync, existsSync, mkdirSync, statSync, copyFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Simple esbuild plugin that copies files/directories at the end of each build.
 * Each asset entry: { from: string, to: string } — paths relative to project root / outdir.
 */
function copyAssetsPlugin(assets) {
    return {
        name: 'copy-assets',
        setup(build) {
            build.onEnd(() => {
                const outdir = build.initialOptions.outdir || 'dist';
                for (const asset of assets) {
                    const src = resolve(__dirname, asset.from);
                    const dest = join(outdir, asset.to);
                    if (!existsSync(src)) continue;
                    if (statSync(src).isDirectory()) {
                        mkdirSync(dest, { recursive: true });
                        cpSync(src, dest, { recursive: true });
                    } else {
                        mkdirSync(dirname(dest), { recursive: true });
                        copyFileSync(src, dest);
                    }
                }
            });
        },
    };
}

const { extensionConfig, telemetryConfig } = autoSelectEsbuildConfig();

// The @vscode/extension-telemetry package exports TelemetryReporter as a named export,
// but @microsoft/vscode-azext-utils imports it as a default import. Patch the CJS bundle
// so that `require(...).default` resolves to TelemetryReporter.
/** @type {import('esbuild').BuildOptions} */
const finalTelemetryConfig = {
    ...telemetryConfig,
    footer: {
        js: 'module.exports.default = module.exports.TelemetryReporter;',
    },
};

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
        // Optional native modules used by ws/jsdom; fail gracefully if absent
        'bufferutil',
        'utf-8-validate',
        'canvas',
        // jsdom xhr-sync-worker is loaded via require.resolve at runtime; keep external and copy it
        './xhr-sync-worker.js',
    ],
    plugins: [
        ...(extensionConfig.plugins ?? []),
        copy({
            resolveFrom: 'out',
            assets: [
                {
                    from: ['./node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js'],
                    to: ['./xhr-sync-worker.js'],
                },
            ],
        }),
        copyAssetsPlugin([
            // Copy azcopy platform packages so they end up in dist/node_modules/ inside the VSIX
            {
                from: 'node_modules/@azure-tools/azcopy-darwin',
                to: 'node_modules/@azure-tools/azcopy-darwin',
            },
            {
                from: 'node_modules/@azure-tools/azcopy-linux',
                to: 'node_modules/@azure-tools/azcopy-linux',
            },
            {
                from: 'node_modules/@azure-tools/azcopy-win32',
                to: 'node_modules/@azure-tools/azcopy-win32',
            },
            {
                from: 'node_modules/@azure-tools/azcopy-win64',
                to: 'node_modules/@azure-tools/azcopy-win64',
            },
        ]),
    ],
};

await autoEsbuildOrWatch({ extensionConfig: finalConfig, telemetryConfig: finalTelemetryConfig });
