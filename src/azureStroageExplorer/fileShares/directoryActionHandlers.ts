/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureActionHandler } from 'vscode-azureextensionui';

export function RegisterDirectoryActionHandlers(actionHandler: AzureActionHandler) {
    actionHandler.registerCommand("azureStorage.deleteDirectory", (node) => node.deleteNode());
    actionHandler.registerCommand("azureStorage.createSubdirectory", (node) => node.createChild(Constants.Directory));
    actionHandler.registerCommand("azureStorage.createTextFile", (node) => node.createChild(Constants.File));
}
