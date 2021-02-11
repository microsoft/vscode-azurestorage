/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from "../extensionVariables";
import { cpUtils } from '../utils/cpUtils';
import { localize } from '../utils/localize';

export const azuriteExtensionId: string = 'Azurite.azurite';
export const emulatorTimeoutMS: number = 3 * 1000;

export async function startEmulator(context: IActionContext, emulatorType: EmulatorType): Promise<void> {
    if (isAzuriteExtensionInstalled()) {
        // Use the Azurite extension
        await vscode.commands.executeCommand(`azurite.start_${emulatorType}`);
        await ext.tree.refresh(context, ext.attachedStorageAccountsTreeItem);
    } else if (await isAzuriteCliInstalled()) {
        // Use the Azurite CLI

        // This task will remain active as long as the user keeps the emulator running. Only show an error if it happens in the first three seconds
        const emulatorTask: Promise<string> = cpUtils.executeCommand(ext.outputChannel, undefined, `azurite-${emulatorType}`);
        ext.outputChannel.show();
        await new Promise((resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
            emulatorTask.catch(reject);
            setTimeout(resolve, emulatorTimeoutMS);
        });

        await ext.tree.refresh(context, ext.attachedStorageAccountsTreeItem);
    } else {
        warnAzuriteNotInstalled(context);
    }
}

export function isAzuriteExtensionInstalled(): boolean {
    return !!vscode.extensions.getExtension(azuriteExtensionId);
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
    void ext.ui.showWarningMessage(localize('mustInstallAzurite', 'You must install the [Azurite extension](command:azureStorage.showAzuriteExtension) to perform this operation.'));
    context.telemetry.properties.cancelStep = 'installAzuriteExtension';
    context.errorHandling.suppressDisplay = true;
    throw new Error(`"${azuriteExtensionId}" extension is not installed.`);
}

export enum EmulatorType {
    blob = 'blob',
    queue = 'queue'
}
