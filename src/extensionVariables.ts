/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeDataProvider, AzExtTreeItem, IAzExtOutputChannel, ITreeItemPickerContext } from "@microsoft/vscode-azext-utils";
import { Activity, PickAppResourceOptions } from '@microsoft/vscode-azext-utils/hostapi';
import * as vscode from 'vscode';
import { ExtensionContext } from "vscode";
import { AzureAccountTreeItem } from '../src/tree/AzureAccountTreeItem';
import { AzureStorageFS } from "./AzureStorageFS";
import { AttachedStorageAccountsTreeItem } from "./tree/AttachedStorageAccountsTreeItem";
import { V2AzureResourcesApi } from './vscode-azureresourcegroups.api.v2';

export interface AzureHostExtensionApi2 {
    /**
     * The `AzExtTreeDataProvider` for the shared app resource view
     */
    readonly appResourceTree: AzExtTreeDataProvider;

    /**
     * The VSCode TreeView for the shared app resource view
     */
    readonly appResourceTreeView: vscode.TreeView<AzExtTreeItem>;

    /**
     * The `AzExtTreeDataProvider` for the shared workspace resource view
     */
    readonly workspaceResourceTree: AzExtTreeDataProvider;

    /**
     * The VSCode TreeView for the shared workspace resource view
     */
    readonly workspaceResourceTreeView: vscode.TreeView<AzExtTreeItem>;

    /**
     * Reveals an item in the shared app resource tree
     * @param resourceId The ARM resource ID to reveal
     */
    revealTreeItem(resourceId: string): Promise<void>;

    /**
     * Show a quick picker of app resources. Set `options.type` to filter the picks.
     */
    pickAppResource<T extends AzExtTreeItem>(context: ITreeItemPickerContext, options?: PickAppResourceOptions): Promise<T>

    /**
     * Registers an activity to appear in the activity window
     * @param activity The activity information to show
     */
    registerActivity(activity: Activity): Promise<void>;
}

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

    export let rgApi: AzureHostExtensionApi2;
    export let rgApi2: V2AzureResourcesApi;
}
