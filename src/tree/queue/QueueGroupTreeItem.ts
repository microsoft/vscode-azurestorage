/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ListQueuesSegmentResponse, QueueItem, ServiceListQueuesSegmentResponse } from '@azure/storage-queue';

import { AzExtParentTreeItem, AzExtTreeItem, GenericTreeItem, ICreateChildImplContext, UserCancelledError, parseError } from '@microsoft/vscode-azext-utils';
import { ResolvedAppResourceTreeItem } from '@microsoft/vscode-azext-utils/hostapi';
import * as path from 'path';
import { ProgressLocation, window } from 'vscode';
import { ResolvedStorageAccount } from '../../StorageAccountResolver';
import { getResourcesPath, maxPageSize } from "../../constants";
import { localize } from "../../utils/localize";
import { AttachedStorageAccountTreeItem } from "../AttachedStorageAccountTreeItem";
import { IStorageRoot } from "../IStorageRoot";
import { IStorageTreeItem } from '../IStorageTreeItem';
import { QueueTreeItem } from './QueueTreeItem';

export class QueueGroupTreeItem extends AzExtParentTreeItem implements IStorageTreeItem {
    private _continuationToken: string | undefined;

    public label: string = "Queues";
    public readonly childTypeLabel: string = "Queue";
    public static contextValue: string = 'azureQueueGroup';
    public contextValue: string = QueueGroupTreeItem.contextValue;
    public parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem;

    public constructor(parent: (ResolvedAppResourceTreeItem<ResolvedStorageAccount> & AzExtParentTreeItem) | AttachedStorageAccountTreeItem) {
        super(parent);
        this.iconPath = {
            light: path.join(getResourcesPath(), 'light', 'AzureQueue.svg'),
            dark: path.join(getResourcesPath(), 'dark', 'AzureQueue.svg')
        };
    }

    public get root(): IStorageRoot {
        return this.parent.root;
    }

    async loadMoreChildrenImpl(clearCache: boolean): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._continuationToken = undefined;
        }

        let queuesResponse: ListQueuesSegmentResponse;
        try {
            queuesResponse = await this.listQueues(this._continuationToken);
        } catch (error) {
            const errorType: string = parseError(error).errorType;
            if (this.root.isEmulated && errorType === 'ECONNREFUSED') {
                return [new GenericTreeItem(this, {
                    contextValue: 'startQueueEmulator',
                    label: 'Start Queue Emulator',
                    commandId: 'azureStorage.startQueueEmulator',
                    includeInTreeItemPicker: false
                })];
            } else if (errorType === 'ENOTFOUND') {
                throw new Error(localize('storageAccountDoesNotSupportQueues', 'This storage account does not support queues.'));
            } else {
                throw error;
            }
        }

        this._continuationToken = queuesResponse.continuationToken;

        return queuesResponse.queueItems?.map((queue: QueueItem) => {
            return new QueueTreeItem(
                this,
                queue);
        }) || [];
    }

    hasMoreChildrenImpl(): boolean {
        return !!this._continuationToken;
    }

    async listQueues(continuationToken?: string): Promise<ListQueuesSegmentResponse> {
        const queueServiceClient = this.root.createQueueServiceClient();
        const response: AsyncIterableIterator<ServiceListQueuesSegmentResponse> = queueServiceClient.listQueues().byPage({ continuationToken, maxPageSize });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (await response.next()).value;
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<QueueTreeItem> {
        const queueName = await context.ui.showInputBox({
            placeHolder: 'Enter a name for the new queue',
            validateInput: QueueGroupTreeItem.validateQueueName
        });

        if (queueName) {
            const currentChildren = await this.getCachedChildren(context);
            if (currentChildren.some(child => child.label === queueName)) {
                throw new Error(localize('queueAlreadyExists', 'The queue "{0}" already exists', queueName));
            }
            return await window.withProgress({ location: ProgressLocation.Window }, async (progress) => {
                context.showCreatingTreeItem(queueName);
                progress.report({ message: `Azure Storage: Creating queue '${queueName}'` });
                const queueCreateResponse = await this.createQueue(queueName);
                return new QueueTreeItem(this, queueCreateResponse);
            });
        }

        throw new UserCancelledError();
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue === QueueTreeItem.contextValue;
    }

    private async createQueue(name: string): Promise<QueueItem> {
        const queueServiceClient = this.root.createQueueServiceClient();
        await queueServiceClient.createQueue(name);

        const queuesResponse: ListQueuesSegmentResponse = await this.listQueues();
        let createdQueue: QueueItem | undefined;
        for (const queue of queuesResponse.queueItems || []) {
            if (queue.name === name) {
                createdQueue = queue;
                break;
            }
        }

        if (!createdQueue) {
            throw new Error(localize('couldNotCreateQueue', `Could not create queue "${name}".`));
        }

        return createdQueue;
    }

    private static validateQueueName(name: string): string | undefined | null {
        const validLength = { min: 3, max: 63 };

        if (!name) {
            return "Queue name cannot be empty";
        }
        if (name.indexOf(" ") >= 0) {
            return "Queue name cannot contain spaces";
        }
        if (name.length < validLength.min || name.length > validLength.max) {
            return `Queue name must contain between ${validLength.min} and ${validLength.max} characters`;
        }
        if (!/^[a-z0-9-]+$/.test(name)) {
            return 'Queue name can only contain lowercase letters, numbers and hyphens';
        }
        if (/--/.test(name)) {
            return 'Queue name cannot contain two hyphens in a row';
        }
        if (/(^-)|(-$)/.test(name)) {
            return 'Queue name cannot begin or end with a hyphen';
        }

        return undefined;
    }
}
