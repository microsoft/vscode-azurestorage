/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler } from 'vscode-azureextensionui';

export function RegisterFileActionHandlers(actionHandler: AzureActionHandler) {
    actionHandler.registerCommand("azureStorage.deleteFile", (node) => node.deleteNode());
}
