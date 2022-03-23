/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DialogResponses, IActionContext } from "@microsoft/vscode-azext-utils";
import { localize } from "./localize";
import { OverwriteChoice } from "./uploadUtils";

// Pass `overwriteChoice` as an object to make use of pass by reference.
export async function checkCanOverwrite(
    context: IActionContext,
    destPath: string,
    overwriteChoice: { choice: OverwriteChoice | undefined },
    destPathExists: () => Promise<boolean>
): Promise<boolean> {
    if (overwriteChoice.choice === OverwriteChoice.yesToAll) {
        // Always overwrite
        return true;
    }

    if (await destPathExists()) {
        if (overwriteChoice.choice === OverwriteChoice.noToAll) {
            // Resources that already exist shouldn't be overwritten
            return false;
        } else {
            overwriteChoice.choice = await showDuplicateResourceWarning(context, destPath);
            switch (overwriteChoice.choice) {
                case OverwriteChoice.no:
                case OverwriteChoice.noToAll:
                    return false;

                case OverwriteChoice.yes:
                case OverwriteChoice.yesToAll:
                default:
                    return true;
            }
        }
    } else {
        // This resource doesn't exist yet, so overwriting is OK
        return true;
    }
}

async function showDuplicateResourceWarning(context: IActionContext, resourceName: string): Promise<OverwriteChoice> {
    const message: string = localize('resourceExists', 'A resource named "{0}" already exists. Do you want to overwrite it?', resourceName);
    const items = [
        { title: localize('yesToAll', 'Yes to all'), data: OverwriteChoice.yesToAll },
        { title: DialogResponses.yes.title, data: OverwriteChoice.yes },
        { title: localize('noToAll', 'No to all'), data: OverwriteChoice.noToAll },
        { title: DialogResponses.no.title, data: OverwriteChoice.no }
    ];
    return (await context.ui.showWarningMessage(message, { modal: true }, ...items)).data;
}
