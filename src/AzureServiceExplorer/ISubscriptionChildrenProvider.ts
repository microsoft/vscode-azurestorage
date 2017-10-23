/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionModels } from 'azure-arm-resource';
import { AzureTreeNodeBase } from './Nodes/AzureTreeNodeBase';
import { AccountManager } from './AccountManager';
import { AzureTreeDataProvider } from './AzureTreeDataProvider';

export interface ISubscriptionChildrenProvider {
    getChildren(accountManager: AccountManager, subscription: SubscriptionModels.Subscription, treeDataProvider: AzureTreeDataProvider, subscriptionNode): Promise<AzureTreeNodeBase[]>;
}
