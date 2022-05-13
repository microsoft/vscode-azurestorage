/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IAzExtOutputChannel } from "@microsoft/vscode-azext-utils";
import { AzureHostExtensionApi } from "@microsoft/vscode-azext-utils/hostapi";
import { ExtensionContext } from "vscode";
import { AzureAccountTreeItem } from '../src/tree/AzureAccountTreeItem';
import { AzureStorageFS } from "./AzureStorageFS";
import { AttachedStorageAccountsTreeItem } from "./tree/AttachedStorageAccountsTreeItem";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
export namespace ext {
    export let context: ExtensionContext;
    export let outputChannel: IAzExtOutputChannel;
    export let ignoreBundle: boolean | undefined;

    export let azureAccountTreeItem: AzureAccountTreeItem;
    export let attachedStorageAccountsTreeItem: AttachedStorageAccountsTreeItem;
    export let azureStorageFS: AzureStorageFS;
    export let azureStorageWorkspaceFS: AzureStorageFS;
    export const azCopyExePath: string = 'azcopy';
    export const prefix: string = 'azureStorage';

    export let rgApi: AzureHostExtensionApi;
}
