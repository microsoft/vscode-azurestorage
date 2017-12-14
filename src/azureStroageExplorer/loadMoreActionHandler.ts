/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

 import * as vscode from 'vscode';
 import { BaseActionHandler } from '../azureServiceExplorer/actions/baseActionHandler';
import { AzureTreeDataProvider, IAzureNode } from 'vscode-azureextensionui';
 
 export class LoadMoreActionHandler extends BaseActionHandler {
     constructor(private treeDataProvider: AzureTreeDataProvider) {
        super();    
     }

     registerActions(context: vscode.ExtensionContext) {
         this.initCommand(context, "azureStorage.loadMoreNode", (node: IAzureNode) => { this.treeDataProvider.loadMore(node) });
     }
 }
