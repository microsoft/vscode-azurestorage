/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri } from 'vscode';
import { getResourcesPath } from "../../constants";
import { IStorageRoot } from "../IStorageRoot";

export class BlobDirectoryTreeItem {
  constructor(
    public root: IStorageRoot,
    public directory: string,
    public prefix: string,
    public readonly container: azureStorage.BlobService.ContainerResult) {
    this.root = root;
  }

  public label: string = this.directory;
  public contextValue: string = 'azureBlobDirectory';
  public iconPath: { light: string | Uri; dark: string | Uri } = {
    light: path.join(getResourcesPath(), 'light', 'document.svg'),
    dark: path.join(getResourcesPath(), 'dark', 'document.svg')
  };
}
