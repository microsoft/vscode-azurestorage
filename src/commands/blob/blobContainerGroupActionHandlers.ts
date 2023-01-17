/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, registerCommandWithTreeNodeUnwrapping } from '@microsoft/vscode-azext-utils';
import { BlobContainerGroupTreeItem } from '../../tree/blob/BlobContainerGroupTreeItem';
import { isAzuriteInstalled, warnAzuriteNotInstalled } from '../../utils/azuriteUtils';
import { createChildNode } from '../commonTreeCommands';

export function registerBlobContainerGroupActionHandlers(): void {
    registerCommandWithTreeNodeUnwrapping("azureStorage.createBlobContainer", createBlobContainer);
}

export async function createBlobContainer(context: IActionContext, treeItem?: BlobContainerGroupTreeItem): Promise<void> {
    if (treeItem?.root.isEmulated && !(await isAzuriteInstalled())) {
        warnAzuriteNotInstalled(context);
    }
    await createChildNode(context, BlobContainerGroupTreeItem.contextValue, treeItem);
}
