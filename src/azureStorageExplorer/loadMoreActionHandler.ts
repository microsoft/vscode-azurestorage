/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import { AzureTreeDataProvider, IAzureNode, AzureActionHandler } from 'vscode-azureextensionui';

export function registerLoadMoreActionHandler(actionHandler: AzureActionHandler, treeDataProvider: AzureTreeDataProvider): void {
  actionHandler.registerCommand("azureStorage.loadMoreNode", (node: IAzureNode) => treeDataProvider.loadMore(node));
}
