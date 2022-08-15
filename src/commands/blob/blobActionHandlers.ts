/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommand } from "@microsoft/vscode-azext-utils";
import { deleteFilesAndDirectories } from "../deleteFilesAndDirectories";

export function registerBlobActionHandlers(): void {
    registerCommand("azureStorage.deleteBlob", deleteFilesAndDirectories);
}
