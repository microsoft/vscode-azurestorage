/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerCommandWithTreeNodeUnwrapping } from '@microsoft/vscode-azext-utils';
import { deleteFilesAndDirectories } from '../deleteFilesAndDirectories';

export function registerFileActionHandlers(): void {
    registerCommandWithTreeNodeUnwrapping("azureStorage.deleteFile", deleteFilesAndDirectories);
}
