/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext, parseError } from "@microsoft/vscode-azext-utils";
import { commands, ConfigurationTarget, extensions, window, workspace } from "vscode";
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

/**
 * Returns true if the error is an Azurite API version mismatch error.
 */
export function isAzuriteApiVersionError(error: unknown): boolean {
    const message = parseError(error).message;
    return /API version .* is not supported by Azurite/i.test(message);
}

/**
 * Prompts the user to enable the `azurite.skipApiVersionCheck` setting.
 * Returns true if the setting was enabled (caller should retry the operation).
 */
export async function promptToSkipApiVersionCheck(): Promise<boolean> {
    const enableSetting = localize('enableSkipApiVersionCheck', 'Enable Skip API Version Check');
    const result = await window.showWarningMessage(
        localize('azuriteApiVersionMismatch',
            'The installed Azure Storage SDK uses an API version not yet supported by Azurite. You can skip this check by enabling the "azurite.skipApiVersionCheck" setting. Azurite will be restarted to apply the change.'),
        enableSetting,
    );

    if (result === enableSetting) {
        const azuriteConfig = workspace.getConfiguration('azurite');
        await azuriteConfig.update('skipApiVersionCheck', true, ConfigurationTarget.Global);

        // Azurite must be restarted for the setting to take effect
        if (isAzuriteExtensionInstalled()) {
            await commands.executeCommand('azurite.close');
            await commands.executeCommand('azurite.start');
        }

        return true;
    }
    return false;
}

export function warnAzuriteNotInstalled(context: IActionContext): void {
    void context.ui.showWarningMessage(localize('mustInstallAzurite', 'You must install the [Azurite extension](command:azureStorage.showAzuriteExtension) to perform this operation.'));
    context.telemetry.properties.cancelStep = 'installAzuriteExtension';
    context.errorHandling.suppressDisplay = true;
    throw new Error(`"${azuriteExtensionId}" extension is not installed.`);
}
