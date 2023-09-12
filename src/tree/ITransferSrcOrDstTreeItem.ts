/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageTreeItem } from "./IStorageTreeItem";

export interface ITransferSrcOrDstTreeItem extends IStorageTreeItem {
    remoteFilePath: string;
    resourceUri: string;
    transferSasToken: string;
}
