/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "@microsoft/vscode-azext-utils";
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../../tree/fileShare/FileShareTreeItem';

export interface IOpenInFileExplorerWizardContext extends IActionContext {
    treeItem: BlobContainerTreeItem | FileShareTreeItem;
    openBehavior?: OpenBehavior;
}

export type OpenBehavior = 'AddToWorkspace' | 'OpenInNewWindow' | 'OpenInCurrentWindow' | 'AlreadyOpen' | 'DontOpen';
