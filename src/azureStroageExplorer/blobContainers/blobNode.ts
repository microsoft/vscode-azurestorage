/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/
 
 import { TreeItem, TreeItemCollapsibleState } from 'vscode';
 import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
 import { AzureTreeNodeBase } from '../../azureServiceExplorer/nodes/azureTreeNodeBase';
 import { AzureTreeDataProvider } from '../../azureServiceExplorer/azureTreeDataProvider';
 import * as azureStorage from "azure-storage";
 import * as path from 'path';
 
 export class BlobNode extends AzureTreeNodeBase {
     constructor(
 		public readonly blob: azureStorage.BlobService.BlobResult,
 		public readonly container: azureStorage.BlobService.ContainerResult,
         public readonly storageAccount: StorageAccount,
         public readonly key: StorageAccountKey,
 		treeDataProvider: AzureTreeDataProvider, 
         parentNode: AzureTreeNodeBase) {
 		super(blob.name, treeDataProvider, parentNode);	
     }
 
     getTreeItem(): TreeItem {
         return {
             label: this.label,
             collapsibleState: TreeItemCollapsibleState.None,
             contextValue: 'azureBlob',
             iconPath: {
 				light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
 				dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
             },
             command:{
                command: 'azureStorage.editBlob',
                arguments: [this],
                title: ''
            }
         }
     }
 }