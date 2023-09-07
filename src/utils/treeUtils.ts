/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, NoResourceFoundError } from "@microsoft/vscode-azext-utils";

export namespace treeUtils {
    export function findNearestParent<T extends AzExtTreeItem>(node: AzExtTreeItem, parentContextValues: string | RegExp | (string | RegExp)[]): T {
        parentContextValues = Array.isArray(parentContextValues) ? parentContextValues : [parentContextValues];
        if (!parentContextValues.length) throw new NoResourceFoundError();

        let currentNode: AzExtTreeItem = node;
        let foundParent: boolean = false;
        while (currentNode.parent) {
            for (const contextValue of parentContextValues) {
                const parentRegex: RegExp = contextValue instanceof RegExp ? contextValue : new RegExp(contextValue);
                if (parentRegex.test(currentNode.contextValue)) {
                    foundParent = true;
                    break;
                }
            }
            if (foundParent) break;
            currentNode = currentNode.parent;
        }
        if (!foundParent) throw new NoResourceFoundError();
        return currentNode as T;
    }
}
