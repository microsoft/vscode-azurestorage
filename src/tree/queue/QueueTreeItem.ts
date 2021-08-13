/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorage from "azure-storage";
import * as path from 'path';
import { AzExtTreeItem, DialogResponses, IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { getResourcesPath } from "../../constants";
import { IStorageRoot } from "../IStorageRoot";
import { QueueGroupTreeItem } from "./QueueGroupTreeItem";

export class QueueTreeItem extends AzExtTreeItem {
    public parent: QueueGroupTreeItem;
    constructor(
        parent: QueueGroupTreeItem,
        public readonly queue: azureStorage.QueueService.QueueResult) {
        super(parent);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureQueue.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureQueue.svg')
        };
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    public label: string = this.queue.name;
    public static contextValue: string = 'azureQueue';
    public contextValue: string = QueueTreeItem.contextValue;

    public async deleteTreeItemImpl(context: IActionContext): Promise<void> {
        const message: string = `Are you sure you want to delete queue '${this.label}' and all its contents?`;
        const result = await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
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
