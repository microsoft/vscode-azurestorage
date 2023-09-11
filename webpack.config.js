/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

// See https://github.com/Microsoft/vscode-azuretools/wiki/webpack for guidance

'use strict';

const process = require('process');
const dev = require("@microsoft/vscode-azext-dev");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

let DEBUG_WEBPACK = !!process.env.DEBUG_WEBPACK;

const config = dev.getDefaultWebpackConfig({
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
        "@azure-tools/azcopy-win64"
    ],
    externals: {
        './getCoreNodeModule': 'commonjs getCoreNodeModule',
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: './out/src/utils/getCoreNodeModule.js', to: 'node_modules' }
            ]
        })
    ]
});

const webConfig = dev.getDefaultWebpackConfig({
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'debug' : 'normal',
    externals:
    {
        // Fix "Module not found" errors in ./node_modules/websocket/lib/{BufferUtil,Validation}.js
        // These files are not in node_modules and so will fail normally at runtime and instead use fallbacks.
        // Make them as external so webpack doesn't try to process them, and they'll simply fail at runtime as before.
        '../build/Release/validation': 'commonjs ../build/Release/validation',
        '../build/default/validation': 'commonjs ../build/default/validation',
        '../build/Release/bufferutil': 'commonjs ../build/Release/bufferutil',
        '../build/default/bufferutil': 'commonjs ../build/default/bufferutil',
    },
    target: 'webworker',
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ]
});

if (DEBUG_WEBPACK) {
    console.log('Config:', config);
}

module.exports = [config, webConfig];
