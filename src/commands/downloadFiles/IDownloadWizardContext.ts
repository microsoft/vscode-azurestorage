/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ExecuteActivityContext, IActionContext } from "@microsoft/vscode-azext-utils";
import { IDownloadableTreeItem } from "../../tree/IDownloadableTreeItem";
import { DownloadItem } from "../transfers/transfers";

export interface IDownloadWizardContext extends IActionContext, ExecuteActivityContext {
    destinationFolder?: string;
    sasUrl?: string;
    treeItems?: IDownloadableTreeItem[];

    allFileDownloads?: DownloadItem[];
    allFolderDownloads?: DownloadItem[];
}
