/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";

export interface IDeleteBlobDirectoryWizardContext extends IActionContext, ExecuteActivityContext {
    dirName?: string;
    blobDirectory?: BlobDirectoryTreeItem;
}
