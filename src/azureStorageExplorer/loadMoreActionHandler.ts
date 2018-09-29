/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import { AzureTreeDataProvider, IAzureNode, registerCommand } from 'vscode-azureextensionui';

export function registerLoadMoreActionHandler(treeDataProvider: AzureTreeDataProvider): void {
  registerCommand("azureStorage.loadMoreNodes", async (node: IAzureNode) => await treeDataProvider.loadMore(node));
}
