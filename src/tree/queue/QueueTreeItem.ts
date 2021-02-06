/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { Uri } from 'vscode';
import { AzureParentTreeItem, AzureTreeItem, DialogResponses, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { ext } from "../../extensionVariables";
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
        const result = await ext.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const queueService = this.root.createQueueService();
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                queueService.deleteQueue(this.queue.name, (err?: any) => {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }
}
