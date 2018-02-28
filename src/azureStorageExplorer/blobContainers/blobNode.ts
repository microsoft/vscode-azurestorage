/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';

import { IAzureTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { Uri, window, SaveDialogOptions } from 'vscode';
import { DialogOptions } from '../../azureServiceExplorer/messageItems/dialogOptions';
import { BlobFileHandler } from './blobFileHandler';
import { BaseNode } from '../baseNode';

export class BlobNode extends BaseNode implements IAzureTreeItem {
  constructor(
    public readonly blob: azureStorage.BlobService.BlobResult,
    public readonly container: azureStorage.BlobService.ContainerResult,
    public readonly storageAccount: StorageAccount,
    public readonly key: StorageAccountKey
  ) {
    super();
  }

  public baseLabel: string = this.blob.name;
  public contextValue: string = 'azureBlob';
  public iconPath: { light: string | Uri; dark: string | Uri } = {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
  };

  public commandId: string = 'azureStorage.editBlob';

  public async deleteTreeItem(_node: IAzureNode): Promise<void> {
    const message: string = `Are you sure you want to delete the blob '${this.label}'?`;
    const result = await window.showWarningMessage(message, DialogOptions.yes, DialogOptions.cancel);
    if (result === DialogOptions.yes) {
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

  public async download(node: IAzureNode<BlobNode>): Promise<void> {
    const handler = new BlobFileHandler();
    await handler.checkCanDownload(node);

    const extension = path.extname(this.blob.name);
    const filters = {
      "All files": ['*']
    };
    if (extension) {
      // This is needed to ensure the file extension is added in the Save dialog, since the filename will be displayed without it by default on Windows
      filters['*' + extension] = [extension];
    }

    const uri: Uri | undefined = await window.showSaveDialog(<SaveDialogOptions>{
      saveLabel: "Download",
      filters,
      defaultUri: Uri.file(this.blob.name)
    });
    if (uri && uri.scheme === 'file') {
      await handler.downloadFile(node, uri.fsPath);
    }
  }
}
