/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';

import { IAzureTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { Uri, window } from 'vscode';
import { DialogBoxResponses } from '../../constants';

export class BlobNode implements IAzureTreeItem {
  constructor(
    public readonly blob: azureStorage.BlobService.BlobResult,
    public readonly container: azureStorage.BlobService.ContainerResult,
    public readonly storageAccount: StorageAccount,
    public readonly key: StorageAccountKey) {
  }

  public label: string = this.blob.name;
  public contextValue: string = 'azureBlob';
  public iconPath: { light: string | Uri; dark: string | Uri } = {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
  };

  public commandId: string = 'azureStorage.editBlob';

  public async deleteTreeItem(_node: IAzureNode): Promise<void> {
    const message: string = `Are you sure you want to delete the blob '${this.label}'?`;
    const result = await window.showWarningMessage(message, DialogBoxResponses.yes, DialogBoxResponses.cancel);
    if (result === DialogBoxResponses.yes) {
      const blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
      await new Promise((resolve, reject) => {
        blobService.deleteBlob(this.container.name, this.blob.name, err => {
          err ? reject(err) : resolve();
        });
      });
    } else {
      throw new UserCancelledError();
    }
  }
}
