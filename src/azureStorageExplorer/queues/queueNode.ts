/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri, window } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { IStorageRoot } from "../IStorageRoot";

export class QueueTreeItem extends AzureTreeItem<IStorageRoot> {
    constructor(
        parent: AzureParentTreeItem,
        public readonly queue: azureStorage.QueueService.QueueResult) {
        super(parent);
    }

    public label: string = this.queue.name;
    public static contextValue: string = 'azureQueue';
    public contextValue: string = QueueTreeItem.contextValue;
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(getResourcesPath(), 'light', 'AzureQueue.svg'),
        dark: path.join(getResourcesPath(), 'dark', 'AzureQueue.svg')
    };

    public async deleteTreeItemImpl(): Promise<void> {
        const message: string = `Are you sure you want to delete queue '${this.label}' and all its contents?`;
        const result = await window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const queueService = this.root.createQueueService();
            await new Promise((resolve, reject) => {
                // tslint:disable-next-line:no-any
                queueService.deleteQueue(this.queue.name, (err?: any) => {
                    // tslint:disable-next-line:no-void-expression // Grandfathered in
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }
}
