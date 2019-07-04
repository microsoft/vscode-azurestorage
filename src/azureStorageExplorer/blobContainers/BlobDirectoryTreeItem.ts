/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import { IStorageRoot } from "../IStorageRoot";

export class BlobDirectoryTreeItem {
  constructor(
    public root: IStorageRoot,
    public directory: string,
    public prefix: string,
    public readonly container: azureStorage.BlobService.ContainerResult) {
  }
}
