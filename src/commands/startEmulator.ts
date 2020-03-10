/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from "../extensionVariables";
import { cpUtils } from '../utils/cpUtils';
import { localize } from '../utils/localize';

const azuriteExtensionId: string = 'Azurite.azurite';
const emulatorTimeoutInSeconds: number = 3;
export const startEmulatorDebounce: number = emulatorTimeoutInSeconds * 1000;

export async function startEmulator(context: IActionContext, emulatorType: EmulatorType): Promise<void> {
    if (!!vscode.extensions.getExtension(azuriteExtensionId)) {
        // Use the Azurite extension
        await vscode.commands.executeCommand(`azurite.start_${emulatorType}`);
        await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
    } else if (await azuriteCLIInstalled()) {
        // Use the Azurite CLI

        // This task will remain active as long as the user keeps the emulator running. Only show an error if it happens in the first three seconds
        const emulatorTask: Promise<string> = cpUtils.executeCommand(ext.outputChannel, undefined, `azurite-${emulatorType}`);
        ext.outputChannel.show();
        await new Promise((resolve: () => void, reject: (error: unknown) => void) => {
            emulatorTask.catch(reject);
            setTimeout(resolve, 3 * 1000);
        });

        await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
    } else {
        const installAzurite: vscode.MessageItem = { title: localize('installAzurite', 'Install Azurite') };
        const message: string = localize('mustInstallAzurite', 'You must install Azurite to start the storage emulator from VS Code.');

        const result: vscode.MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, installAzurite);
        if (result === installAzurite) {
            context.telemetry.properties.installAzuriteExtension = 'true';
            await vscode.commands.executeCommand('extension.open', azuriteExtensionId);
        }
    }
}

async function azuriteCLIInstalled(): Promise<boolean> {
    try {
        await cpUtils.executeCommand(undefined, undefined, 'azurite -v');
        return true;
    } catch {
        return false;
    }
}

export enum EmulatorType {
    blob = 'blob',
    queue = 'queue'
}
