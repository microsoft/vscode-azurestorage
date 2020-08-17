/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';

/**
 * Returns absolute path to the available AzCopy
 * executable. Paths are grabbed from the
 * available exe module.
 */
export function getAzCopyExe(): string {
    if (os.platform() === "win32") {
        // tslint:disable:no-require-imports
        // tslint:disable: no-unsafe-any
        let azCopyExeModule64: { AzCopyExe: string, AzCopyExe64: string } = require("@azure-tools/azcopy-win64");
        let azCopyExeModule32: { AzCopyExe: string, AzCopyExe32: string } = require("@azure-tools/azcopy-win32");
        return (process.arch.toLowerCase() === "x64" || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432")) ? azCopyExeModule64.AzCopyExe : azCopyExeModule32.AzCopyExe;
    } else if (os.platform() === "darwin") {
        let azCopyExeModule64: { AzCopyExe: string, AzCopyExe64: string } = require("@azure-tools/azcopy-darwin");
        return azCopyExeModule64.AzCopyExe;
    } else {
        let azCopyExeModule64: { AzCopyExe: string, AzCopyExe64: string } = require("@azure-tools/azcopy-linux");
        return azCopyExeModule64.AzCopyExe;
    }
}
