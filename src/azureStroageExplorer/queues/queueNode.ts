/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Uri } from 'vscode';
import { StorageAccount, StorageAccountKey } from '../../../node_modules/azure-arm-storage/lib/models';
import { SubscriptionModels } from 'azure-arm-resource';
import * as azureStorage from "azure-storage";
import * as path from 'path';
import { IAzureTreeItem } from 'vscode-azureextensionui';

export class QueueNode implements IAzureTreeItem {
    constructor(
        public readonly subscription: SubscriptionModels.Subscription, 
		public readonly queue: azureStorage.QueueService.QueueResult,
        public readonly storageAccount: StorageAccount,
        public readonly key: StorageAccountKey) {		
    }

    public id: string = undefined;
    public label: string = this.queue.name;
    public contextValue: string = 'azureQueue';
    public iconPath: { light: string | Uri; dark: string | Uri } =  {
        light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'light', 'AzureQueue_16x.svg'),
        dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'dark', 'AzureQueue_16x.svg')
    };
}
