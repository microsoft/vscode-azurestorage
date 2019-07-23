/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzExtTreeItem, IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { parseUri } from './parseUri';

const rootMap: Map<string, AzExtTreeItem> = new Map<string, AzExtTreeItem>();

export async function findRoot(uri: vscode.Uri, fileType: string, context: IActionContext): Promise<AzExtTreeItem> {
    let rootPath = parseUri(uri, fileType).rootPath;
    let root = rootMap.get(rootPath);
    if (!!root) {
        return root;
    } else {
        root = await ext.tree.findTreeItem(rootPath, context);
        if (!root) {
            throw vscode.FileSystemError.FileNotFound(rootPath);
        } else {
            rootMap.set(rootPath, root);
            return root;
        }
    }
}
