/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

// See https://github.com/Microsoft/vscode-azuretools/wiki/webpack for guidance

'use strict';

const process = require('process');
const dev = require("vscode-azureextensiondev");
const CopyWebpackPlugin = require('copy-webpack-plugin');

let DEBUG_WEBPACK = !!process.env.DEBUG_WEBPACK;

let config = dev.getDefaultWebpackConfig({
    projectRoot: __dirname,
    verbosity: DEBUG_WEBPACK ? 'debug' : 'normal',
    externals: {
        './getCoreNodeModule': 'commonjs getCoreNodeModule',
        '@azure-tools/azcopy-darwin': true,
        '@azure-tools/azcopy-linux': true,
        '@azure-tools/azcopy-win32': true,
        '@azure-tools/azcopy-win64': true,
        '@storage-explorer/macos-keychain': true,
        'keytar': true
    },
    plugins: [
        new CopyWebpackPlugin([
            { from: './out/src/utils/getCoreNodeModule.js', to: 'node_modules' }
        ])
    ]
});

if (DEBUG_WEBPACK) {
    console.log('Config:', config);
}

module.exports = config;
