/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "vscode-azureextensionui";
import { BlobContainerTreeItem } from '../blobContainers/blobContainerNode';
import { FileShareTreeItem } from '../fileShares/fileShareNode';

export interface IOpenInFileExplorerWizardContext extends IActionContext {
    treeItem?: BlobContainerTreeItem | FileShareTreeItem;
    openBehavior?: OpenBehavior;
}

export type OpenBehavior = 'AddToWorkspace' | 'OpenInNewWindow' | 'OpenInCurrentWindow' | 'AlreadyOpen' | 'DontOpen';
