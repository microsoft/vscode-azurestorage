/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri, window } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem, IAzureNode, UserCancelledError } from 'vscode-azureextensionui';
import { DialogOptions } from '../../azureServiceExplorer/messageItems/dialogOptions';

export class QueueNode implements IAzureTreeItem {
    constructor(
        public readonly queue: azureStorage.QueueService.QueueResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {
    }

    public label: string = this.queue.name;
    public contextValue: string = 'azureQueue';
    public iconPath: { light: string | Uri; dark: string | Uri } = {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureQueue_16x.png'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureQueue_16x.png')
    };

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete queue '${this.label}' and all its contents?`;
        const result = await window.showWarningMessage(message, DialogOptions.yes, DialogOptions.cancel);
        if (result === DialogOptions.yes) {
            const queueService = azureStorage.createQueueService(this.storageAccount.name, this.key.value);
            await new Promise((resolve, reject) => {
                queueService.deleteQueue(this.queue.name, err => {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }
}
