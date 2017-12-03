/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import { AzureTreeNodeBase } from './nodes/azureTreeNodeBase';
import { AccountManager } from './accountManager';
import { AzureTreeDataProvider } from './azureTreeDataProvider';

export interface ISubscriptionChildrenProvider {
    getMoreChildren(accountManager: AccountManager, subscription: SubscriptionModels.Subscription, treeDataProvider: AzureTreeDataProvider, subscriptionNode): Promise<AzureTreeNodeBase[]>;
    hasMoreChildren(): boolean;
}
