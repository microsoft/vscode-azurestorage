/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, TreeView } from "vscode";
import { AzExtTreeDataProvider, AzExtTreeItem, IAzExtOutputChannel, IAzureUserInput } from "vscode-azureextensionui";
import { AzureAccountTreeItem } from '../src/tree/AzureAccountTreeItem';
import { AzureStorageFS } from "./AzureStorageFS";
import { azcopy } from "./constants";
import { AttachedStorageAccountsTreeItem } from "./tree/AttachedStorageAccountsTreeItem";

/**
 * Namespace for common variables used throughout the extension. They must be initialized in the activate() method of extension.ts
 */
export namespace ext {
    export let context: ExtensionContext;
    export let outputChannel: IAzExtOutputChannel;
    export let ui: IAzureUserInput;
    export let ignoreBundle: boolean | undefined;

    export let tree: AzExtTreeDataProvider;
    export let treeView: TreeView<AzExtTreeItem>;
    export let azureAccountTreeItem: AzureAccountTreeItem;
    export let attachedStorageAccountsTreeItem: AttachedStorageAccountsTreeItem;
    export let azureStorageFS: AzureStorageFS;
    export let azCopyExePath: string = azcopy;
    export const prefix: string = 'azureStorage';
}
