/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.md in the project root for license information.
  **/

import * as azureStorage from "azure-storage";
import * as clipboardy from 'clipboardy';
import * as path from 'path';
import { MessageItem, SaveDialogOptions, Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
import { ICopyUrl } from '../../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";
import { BlobFileHandler } from './blobFileHandler';

export class BlobTreeItem extends AzureTreeItem<IStorageRoot> implements ICopyUrl {
  public contextValue: string = 'azureBlob';
  public static contextValue: string = 'azureBlob';

  public commandId: string = 'azureStorage.editBlob';

  public label: string = this.blob.name;
  public fullPath: string = path.posix.join(this.directoryPath, this.blob.name);

  constructor(
    parent: AzureParentTreeItem,
    public readonly directoryPath: string,
    public readonly blob: azureStorage.BlobService.BlobResult,
    public readonly container: azureStorage.BlobService.ContainerResult) {
    super(parent);
  }

  public iconPath: { light: string | Uri; dark: string | Uri } = {
    light: path.join(getResourcesPath(), 'light', 'document.svg'),
    dark: path.join(getResourcesPath(), 'dark', 'document.svg')
  };

  public async copyUrl(): Promise<void> {
    let blobService = this.root.createBlobService();
    let url = blobService.getUrl(this.container.name, this.blob.name);
    await clipboardy.write(url);
    ext.outputChannel.show();
    ext.outputChannel.appendLine(`Blob URL copied to clipboard: ${url}`);
  }

  public async deleteTreeItemImpl(context: ISuppressMessageContext): Promise<void> {
    let result: MessageItem | undefined;
    if (!context.suppressMessage) {
      const message: string = `Are you sure you want to delete the blob '${this.label}'?`;
      result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    }
    if (result === DialogResponses.deleteResponse || context.suppressMessage) {
      let blobService = this.root.createBlobService();
      await new Promise((resolve, reject) => {
        // tslint:disable-next-line:no-any
        blobService.deleteBlob(this.container.name, this.fullPath, (err?: any) => {
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

export interface ISuppressMessageContext extends IActionContext {
  suppressMessage: boolean;
}
