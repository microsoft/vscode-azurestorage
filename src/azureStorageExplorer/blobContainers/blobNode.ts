/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.txt in the project root for license information.
  **/

import * as azureStorage from "azure-storage";
import * as copypaste from 'copy-paste';
import * as path from 'path';
import { SaveDialogOptions, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { StorageAccountKeyWrapper, StorageAccountWrapper } from "../../components/storageWrappers";
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { BlobFileHandler } from './blobFileHandler';

export class BlobTreeItem extends AzureTreeItem implements ICopyUrl {
  constructor(
    parent: AzureParentTreeItem,
    public readonly blob: azureStorage.BlobService.BlobResult,
    public readonly container: azureStorage.BlobService.ContainerResult,
    public readonly storageAccount: StorageAccountWrapper,
    public readonly key: StorageAccountKeyWrapper) {
    super(parent);
  }

  public label: string = this.blob.name;
  public contextValue: string = 'azureBlob';
  public iconPath: { light: string | Uri; dark: string | Uri } = {
    light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'document.svg'),
    dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'document.svg')
  };

  public commandId: string = 'azureStorage.editBlob';

  public async copyUrl(): Promise<void> {
    let blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
    let url = blobService.getUrl(this.container.name, this.blob.name);
    copypaste.copy(url);
    ext.outputChannel.show();
    ext.outputChannel.appendLine(`Blob URL copied to clipboard: ${url}`);
  }

  public async deleteTreeItemImpl(): Promise<void> {
    const message: string = `Are you sure you want to delete the blob '${this.label}'?`;
    const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    if (result === DialogResponses.deleteResponse) {
      const blobService = azureStorage.createBlobService(this.storageAccount.name, this.key.value);
      await new Promise((resolve, reject) => {
        // tslint:disable-next-line:no-any
        blobService.deleteBlob(this.container.name, this.blob.name, (err?: any) => {
          // tslint:disable-next-line:no-void-expression // Grandfathered in
          err ? reject(err) : resolve();
        });
      });
    } else {
      throw new UserCancelledError();
    }
  }

  public async download(): Promise<void> {
    const handler = new BlobFileHandler();
    await handler.checkCanDownload(this);

    const extension = path.extname(this.blob.name);
    const filters = {
      "All files": ['*']
    };
    if (extension) {
      // This is needed to ensure the file extension is added in the Save dialog, since the filename will be displayed without it by default on Windows
      filters[`*${extension}`] = [extension];
    }

    const uri: Uri | undefined = await window.showSaveDialog(<SaveDialogOptions>{
      saveLabel: "Download",
      filters,
      defaultUri: Uri.file(this.blob.name)
    });
    if (uri && uri.scheme === 'file') {
      await handler.downloadFile(this, uri.fsPath);
    }
  }
}
