/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ActivityChildItemBase, ActivityChildType, ExecuteActivityContext } from "@microsoft/vscode-azext-utils";
import { ext } from "../extensionVariables";
import { getWorkspaceSetting } from "./settingsUtils";

export async function createActivityContext(options?: { withChildren?: boolean }): Promise<ExecuteActivityContext> {
    return {
        registerActivity: async (activity) => ext.rgApi.registerActivity(activity),
        suppressNotification: await getWorkspaceSetting('suppressActivityNotifications', undefined, 'azureResourceGroups'),
        activityChildren: options?.withChildren ? [] : undefined,
    };
}

/**
 * Adds a new activity child after the last info child in the `activityChildren` array.
 * If no info child already exists, the new child is prepended to the front of the array.
 * (This utility function is useful for keeping the info children grouped at the front of the list)
 */
export type ActivityInfoChild = ActivityChildItemBase & { activityType: ActivityChildType.Info };
export function prependOrInsertAfterLastInfoChild(context: Partial<ExecuteActivityContext>, infoChild: ActivityInfoChild): void {
    if (!context.activityChildren) {
        return;
    }

    const idx: number = context.activityChildren
        .map(child => child.activityType)
        .lastIndexOf(ActivityChildType.Info);

    if (idx === -1) {
        context.activityChildren.unshift(infoChild);
    } else {
        context.activityChildren.splice(idx + 1, 0, infoChild);
    }
}
