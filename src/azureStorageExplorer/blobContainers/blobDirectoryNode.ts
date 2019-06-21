/*
  *  Copyright (c) Microsoft Corporation. All rights reserved.
  *  Licensed under the MIT License. See License.md in the project root for license information.
  **/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ICopyUrl } from '../../ICopyUrl';
import { IStorageRoot } from "../IStorageRoot";

export class BlobDirectoryTreeItem extends AzureTreeItem<IStorageRoot> implements ICopyUrl {

  constructor(
    parent: AzureParentTreeItem,
    public directory: string,
    public prefix: string,
    public readonly container: azureStorage.BlobService.ContainerResult) {
    super(parent);
  }

  public label: string = this.directory;
  public contextValue: string = 'azureBlobDirectory';
  public iconPath: { light: string | Uri; dark: string | Uri } = {
    light: path.join(getResourcesPath(), 'light', 'document.svg'),
    dark: path.join(getResourcesPath(), 'dark', 'document.svg')
  };

  copyUrl(): void {
    throw new Error("Method not implemented.");
  }
}
