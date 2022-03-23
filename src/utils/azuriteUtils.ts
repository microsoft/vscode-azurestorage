/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from "@microsoft/vscode-azext-utils";
import { extensions } from "vscode";
import { azuriteExtensionId } from "../constants";
import { cpUtils } from "./cpUtils";
import { localize } from "./localize";

export async function isAzuriteInstalled(): Promise<boolean> {
    return isAzuriteExtensionInstalled() || await isAzuriteCliInstalled();
}

export function isAzuriteExtensionInstalled(): boolean {
    return !!extensions.getExtension(azuriteExtensionId);
}

export async function isAzuriteCliInstalled(): Promise<boolean> {
    try {
        await cpUtils.executeCommand(undefined, undefined, 'azurite -v');
        return true;
    } catch {
        return false;
    }
}

export function warnAzuriteNotInstalled(context: IActionContext): void {
    void context.ui.showWarningMessage(localize('mustInstallAzurite', 'You must install the [Azurite extension](command:azureStorage.showAzuriteExtension) to perform this operation.'));
    context.telemetry.properties.cancelStep = 'installAzuriteExtension';
    context.errorHandling.suppressDisplay = true;
    throw new Error(`"${azuriteExtensionId}" extension is not installed.`);
}
