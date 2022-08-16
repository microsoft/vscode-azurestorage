/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem } from "@microsoft/vscode-azext-utils";
import { localize } from "./localize";

export namespace treeUtils {
    export function findNearestParent<T extends AzExtTreeItem>(node: AzExtTreeItem, parents: T | T[]): T {
        const notFoundMessage: string = localize('parentNotFound', 'Could not find a valid nearest parent.');
        if (!parents) throw new Error(notFoundMessage);
        if (!Array.isArray(parents)) {
            parents = [parents];
        }
        if (!parents.length) throw new Error(notFoundMessage);

        const parentInstances: Set<string> = new Set();
        parents.forEach(p => { parentInstances.add(p.constructor.name) });
        let foundParent: boolean = false;
        let currentNode: AzExtTreeItem = node;
        while (currentNode.parent) {
            if (parentInstances.has(currentNode.constructor.name)) {
                foundParent = true;
                break;
            }
            currentNode = currentNode.parent;
        }
        if (!foundParent) {
            throw new Error(notFoundMessage);
        }
        return currentNode as T;
    }
}
