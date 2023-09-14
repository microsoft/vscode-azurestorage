/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

// See https://github.com/Microsoft/vscode-azuretools/wiki/webpack for guidance

'use strict';

const process = require('process');
const dev = require("@microsoft/vscode-azext-dev");
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

let DEBUG_WEBPACK = !!process.env.DEBUG_WEBPACK;

const desktopConfig = dev.getDefaultWebpackConfig({
    target: 'node',
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'debug' : 'normal',
    externalNodeModules: [
        // Modules that we can't easily webpack for some reason.
        // These and their dependencies will be copied into node_modules rather than placed in the bundle
        // Keep this list small, because all the sub-dependencies will also be excluded
        "@azure-tools/azcopy-darwin",
        "@azure-tools/azcopy-linux",
        "@azure-tools/azcopy-win32",
        "@azure-tools/azcopy-win64",
    ],
    externals: {
        './getCoreNodeModule': 'commonjs getCoreNodeModule',
        // Fix "Module not found" errors in ws and jsdom.
        // These modules are not in node_modules and so will fail normally at runtime and instead use fallbacks.
        // Make them as external so webpack doesn't try to process them, and they'll simply fail at runtime as before.
        "bufferutil": "commonjs bufferutil",
        "utf-8-validate": "commonjs utf-8-validate",
        "canvas": "commonjs canvas",
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: './out/src/utils/getCoreNodeModule.js', to: 'node_modules' }
            ]
        }),
        new webpack.IgnorePlugin({
            resourceRegExp: /canvas/,
            contextRegExp: /jsdom$/,
        }),
    ],
    suppressCleanDistFolder: true
});

const webConfig = dev.getDefaultWebpackConfig({
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'debug' : 'normal',
    externals: {
        // AzCopy exes are not available in the browser, so we need to exclude it from the bundle.
        "@azure-tools/azcopy-win32": "@azure-tools/azcopy-win32",
        "@azure-tools/azcopy-win64": "@azure-tools/azcopy-win64",
        "@azure-tools/azcopy-linux": "@azure-tools/azcopy-linux",
        "@azure-tools/azcopy-darwin": "@azure-tools/azcopy-darwin",
        // Since AzCopy exes are not available, exclude the root azcopy-node wrapper package.
        "@azure-tools/azcopy-node": "@azure-tools/azcopy-node",
        // Fix "Module not found" errors in ws and jsdom.
        // These modules are not in node_modules and so will fail normally at runtime and instead use fallbacks.
        // Make them as external so webpack doesn't try to process them, and they'll simply fail at runtime as before.
        "bufferutil": "commonjs bufferutil",
        "utf-8-validate": "commonjs utf-8-validate",
        "canvas": "commonjs canvas",
    },
    target: 'webworker',
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new NodePolyfillPlugin({
            includeAliases: [
                "path", "stream", "process", "Buffer", "zlib"
            ]
        }),
        new webpack.IgnorePlugin({
            resourceRegExp: /canvas/,
            contextRegExp: /jsdom$/,
        }),
    ],
    suppressCleanDistFolder: true,
    resolveFallbackAliases: {
        // @ts-ignore
        "timers": require.resolve("timers-browserify"),
        child_process: false,
        crypto: false,
        http: false,
        https: false,
        os: false,
        perf_hooks: false,
        fs: false,
        net: false,
        tls: false,
        canvas: false,
        constants: false
    }
});

if (DEBUG_WEBPACK) {
    console.log('Desktop config:', desktopConfig);
    console.log('Web config:', webConfig);
}

module.exports = [desktopConfig, webConfig];
