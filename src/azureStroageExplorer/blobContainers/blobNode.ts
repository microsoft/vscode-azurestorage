/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/
 
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
 
import { IAzureTreeItem } from 'vscode-azureextensionui';
import { Uri } from 'vscode';

 export class BlobNode implements IAzureTreeItem {
     constructor(
 		public readonly blob: azureStorage.BlobService.BlobResult,
 		public readonly container: azureStorage.BlobService.ContainerResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
     }

     public id: string = undefined;
     public label: string = this.blob.name;
     public contextValue: string = 'azureBlob';
     public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
    };

    public commandId: string = 'azureStorage.editBlob';
 }