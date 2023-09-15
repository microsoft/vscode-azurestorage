/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, NoResourceFoundError, TreeItemIconPath } from "@microsoft/vscode-azext-utils";
import { Uri } from "vscode";
import { ext } from "../extensionVariables";

export namespace treeUtils {
    export function getThemedIconPath(iconName: string): TreeItemIconPath {
        return {
            light: Uri.joinPath(getResourcesUri(), "light", `${iconName}.svg`),
            dark: Uri.joinPath(getResourcesUri(), "dark", `${iconName}.svg`),
        }
    }

    export function getIconPath(iconName: string): TreeItemIconPath {
        return Uri.joinPath(getResourcesUri(), `${iconName}.svg`);
    }

    function getResourcesUri(): Uri {
        return Uri.joinPath(ext.context.extensionUri, 'resources')
    }

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
