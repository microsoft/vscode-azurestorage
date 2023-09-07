/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { BlobTreeItem } from "../../tree/blob/BlobTreeItem";

export interface IDeleteBlobWizardContext extends IActionContext, ExecuteActivityContext {
    blobName?: string;
    blob?: BlobTreeItem;
}
