/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtParentTreeItem, AzExtTreeItem, callWithTelemetryAndErrorHandling, IActionContext } from "@microsoft/vscode-azext-utils";
import { WorkspaceResourceProvider } from "@microsoft/vscode-azext-utils/hostapi";
import { Disposable } from "vscode";
import { ext } from "./extensionVariables";
import { AttachedStorageAccountsTreeItem } from "./tree/AttachedStorageAccountsTreeItem";


export class StorageWorkspaceProvider implements WorkspaceResourceProvider {

    public disposables: Disposable[] = [];

    constructor(parent: AzExtParentTreeItem) {
        ext.attachedStorageAccountsTreeItem = new AttachedStorageAccountsTreeItem(parent);
    }

    public async provideResources(): Promise<AzExtTreeItem[] | null | undefined> {

        return await callWithTelemetryAndErrorHandling('StorageWorkspaceProvider.provideResources', async (_context: IActionContext) => {
            return [ext.attachedStorageAccountsTreeItem];
        });
    }
    private _projectDisposables: Disposable[] = [];

    public dispose(): void {
        Disposable.from(...this._projectDisposables).dispose();
    }
}
