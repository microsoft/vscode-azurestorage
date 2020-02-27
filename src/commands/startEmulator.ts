/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from "../extensionVariables";
import { cpUtils } from '../utils/cpUtils';
import { localize } from '../utils/localize';

export enum EmulatorType {
    blob = 'blob',
    queue = 'queue'
}

export async function startEmulator(context: IActionContext, emulatorType: EmulatorType): Promise<void> {
    if (!!vscode.extensions.getExtension('Azurite.azurite')) {
        // Use the Azurite extension
        await vscode.commands.executeCommand(`azurite.start_${emulatorType}`);
    } else if (await azuriteCLIInstalled()) {
        // Use the Azurite CLI
        ext.outputChannel.show();

        // This is a long running command, don't await it
        // tslint:disable-next-line: no-floating-promises
        cpUtils.executeCommand(ext.outputChannel, undefined, `azurite-${emulatorType}`);
    } else {
        let selected: string = <'Install Azurite'>await vscode.window.showWarningMessage(localize('mustInstallAzurite', 'You must install Azurite to use the Storage Emulator.'), localize('installAzurite', 'Install Azurite'));
        if (selected === 'Install Azurite') {
            context.telemetry.properties.installAzuriteExtension = 'true';
            await vscode.commands.executeCommand('extension.open', 'Azurite.azurite');
        } else {
            throw new UserCancelledError();
        }
    }

    // Wait for emulator to start before refreshing tree view
    setTimeout(async () => { await ext.tree.refresh(ext.attachedStorageAccountsTreeItem); }, 2000);
}

async function azuriteCLIInstalled(): Promise<boolean> {
    try {
        await cpUtils.executeCommand(undefined, undefined, 'azurite -v');
        return true;
    } catch {
        return false;
    }
}
