/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeItem, IActionContext } from 'vscode-azureextensionui';
import { selectStorageAccountTreeItemForCommand } from './selectStorageAccountNodeForCommand';

export async function configureStaticWebsite(actionContext: IActionContext, treeItem?: AzureTreeItem, promptForSettings?: boolean): Promise<void> {
    let accountTreeItem = await selectStorageAccountTreeItemForCommand(
        treeItem,
        actionContext,
        {
            mustBeWebsiteCapable: true,
            askToConfigureWebsite: false
        });
    await accountTreeItem.configureStaticWebsite(promptForSettings);
}

export async function configureStaticWebsiteAdvanced(actionContext: IActionContext, treeItem?: AzureTreeItem): Promise<void> {
    await configureStaticWebsite(actionContext, treeItem, true);
}
