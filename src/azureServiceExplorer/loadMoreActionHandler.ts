/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { BaseActionHandler } from './actions/baseActionHandler';
import { LoadMoreNode } from './nodes/loadMoreNode';

export class LoadMoreActionHandler extends BaseActionHandler {
    registerActions(context: vscode.ExtensionContext) {
        this.initCommand(context, "azureStorage.loadMoreNode", (node) => { this.loadMore(node) });
    }

    loadMore(node: LoadMoreNode) {
        node.loadMore();
    }
}
