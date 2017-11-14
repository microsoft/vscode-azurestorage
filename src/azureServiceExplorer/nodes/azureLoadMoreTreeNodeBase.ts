/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureTreeDataProvider } from '../azureTreeDataProvider';
import { LoadMoreNode } from './loadMoreNode';
import { AzureTreeNodeBase } from './azureTreeNodeBase';

export abstract class AzureLoadMoreTreeNodeBase extends AzureTreeNodeBase {
    private _loadMoreNode: AzureTreeNodeBase;
    private _hasFetched: boolean;
    private _children: AzureTreeNodeBase[] = [];

    protected constructor(label: string, treeDataProvider: AzureTreeDataProvider, parentNode?: AzureTreeNodeBase) {
        super(label, treeDataProvider, parentNode);
    }    

    async getChildren(): Promise<any> {
        if (!this._hasFetched) {
			await this.addMoreChildren();
			this._hasFetched = true;
        }
        
		return this.hasMoreChildren() ? this._children.concat([this._getLoadMoreNode()]) : this._children;
    }

    private _getLoadMoreNode(): AzureTreeNodeBase {
        if(!this._loadMoreNode) {
            this._loadMoreNode = new LoadMoreNode(this.treeDataProvider,this, () => this._loadMoreChildren());
        }
        
        return this._loadMoreNode;
    }

    private async _loadMoreChildren(): Promise<any> {
        await this.addMoreChildren();
        this.treeDataProvider.refresh(this);
    }

    async addMoreChildren(): Promise<any> {
        var newChildren = await this.getMoreChildren();
        this._children = this._children.concat(newChildren);
    }

    abstract async getMoreChildren(): Promise<any[]>;    
    abstract hasMoreChildren(): boolean;
}
