/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { QueueItem } from '@azure/storage-queue';

import { AzExtTreeItem, DialogResponses, IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import * as path from 'path';
import { getResourcesPath } from "../../constants";
import { IStorageRoot } from "../IStorageRoot";
import { IStorageTreeItem } from '../IStorageTreeItem';
import { QueueGroupTreeItem } from "./QueueGroupTreeItem";

export class QueueTreeItem extends AzExtTreeItem implements IStorageTreeItem {
    public parent: QueueGroupTreeItem;
    constructor(
        parent: QueueGroupTreeItem,
        public readonly queue: QueueItem) {
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
            const queueServiceClient = await this.root.createQueueServiceClient();
            await queueServiceClient.deleteQueue(this.queue.name);
        } else {
            throw new UserCancelledError();
        }
    }
}
