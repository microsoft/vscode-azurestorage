/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionTreeItemBase } from '@microsoft/vscode-azext-azureutils';
import { AzExtTreeItem, IActionContext } from '@microsoft/vscode-azext-utils';
import { AttachedStorageAccountTreeItem } from './AttachedStorageAccountTreeItem';

export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
    public childTypeLabel: string = "Storage Account";
    public supportsAdvancedCreation: boolean = true;

    private _nextLink: string | undefined;

    async loadMoreChildrenImpl(clearCache: boolean, _context: IActionContext): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }
        return [];
    }

    public hasMoreChildrenImpl(): boolean {
        return !!this._nextLink;
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue !== AttachedStorageAccountTreeItem.baseContextValue && contextValue !== AttachedStorageAccountTreeItem.emulatedContextValue;
    }
}
