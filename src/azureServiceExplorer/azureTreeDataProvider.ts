/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeDataProvider, TreeItem, EventEmitter, Event } from 'vscode';
import { AccountManager } from './accountManager';
import { SubscriptionNode } from './nodes/subscriptionNode';
import { ISubscriptionChildrenProvider } from './ISubscriptionChildrenProvider';
import { AzureTreeNodeBase } from './nodes/azureTreeNodeBase';

import { LoadingNode } from './nodes/loadingNode';
import { NotSignedInNode } from './nodes/notSignedInNode';
import { SelectSubscriptionsNode } from './nodes/selectSubscriptionsNode';

export class AzureTreeDataProvider implements TreeDataProvider<AzureTreeNodeBase> {
    private readonly _azureAccount: AccountManager;
    private _onDidChangeTreeData: EventEmitter<AzureTreeNodeBase> = new EventEmitter<AzureTreeNodeBase>();
    private _subscriptionChildrenDataProviders: ISubscriptionChildrenProvider[] = [];
    readonly onDidChangeTreeData: Event<AzureTreeNodeBase> = this._onDidChangeTreeData.event;

    constructor(azureAccount: AccountManager) {
        this._azureAccount = azureAccount;
        this._azureAccount.registerStatusChangedListener(this.onSubscriptionChanged, this);
        this._azureAccount.registerFiltersChangedListener(this.onSubscriptionChanged, this);

    }

    registerSubscriptionChildrenProvider(subscriptionChildrenProvider: ISubscriptionChildrenProvider) {
        this._subscriptionChildrenDataProviders.push(subscriptionChildrenProvider);
    }

    public refresh(element?: AzureTreeNodeBase): void {
        this._onDidChangeTreeData.fire(element);
    }

    getTreeItem(element: AzureTreeNodeBase): TreeItem {
        return element.getTreeItem();
    }

    getChildren(element?: AzureTreeNodeBase): AzureTreeNodeBase[] | Thenable<AzureTreeNodeBase[]> {
        if (this.azureAccount.signInStatus === 'Initializing' || this.azureAccount.signInStatus === 'LoggingIn') {
            return [new LoadingNode(this)];
        }

        if (this.azureAccount.signInStatus === 'LoggedOut') {
            return [new NotSignedInNode(this)];
        }

        if (!element) {     // Top level, no parent element.
            return this.getSubscriptions();
        }

        return element.getChildren();
    }

    get azureAccount(): AccountManager {
        return this._azureAccount;
    }

    private async getSubscriptions(): Promise<AzureTreeNodeBase[]> {
        const subscriptions = await this.azureAccount.getFilteredSubscriptions();

        if (subscriptions.length > 0) {
            const nodes = subscriptions.map<SubscriptionNode>(subscription => {
                return new SubscriptionNode(subscription, this, null, this._subscriptionChildrenDataProviders);
            });

            return nodes;
        }

        return [new SelectSubscriptionsNode(this, null)];
    }

    private onSubscriptionChanged() {
        this.refresh();
    }
}