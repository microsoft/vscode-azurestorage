/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as vscode from 'vscode';
import { IActionContext, UserCancelledError } from 'vscode-azureextensionui';
import { ext } from "../extensionVariables";
import { cpUtils } from '../utils/cpUtils';
import { delay } from '../utils/delay';
import { localize } from '../utils/localize';

const emulatorTimeoutInSeconds: number = 3;
export const emulatorTimeoutInMillis: number = emulatorTimeoutInSeconds * 1000;

export async function startEmulator(context: IActionContext, emulatorType: EmulatorType): Promise<void> {
    if (!!vscode.extensions.getExtension('Azurite.azurite')) {
        // Use the Azurite extension
        await vscode.commands.executeCommand(`azurite.start_${emulatorType}`);
        await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
    } else if (await azuriteCLIInstalled()) {
        // Use the Azurite CLI

        let childProcWrapper: IChildProcWrapper = {};
        let emulatorError: Error | undefined;

        // This is a long running command, don't await it
        // tslint:disable-next-line: no-floating-promises
        cpUtils.executeCommand(ext.outputChannel, undefined, `azurite-${emulatorType}`, childProcWrapper);
        const startTime: number = Date.now();
        ext.outputChannel.show();

        if (childProcWrapper.childProc) {
            childProcWrapper.childProc.addListener('close', () => {
                // This process shouldn't end prematurely unless an error ocurred
                emulatorError = new Error(localize('failedToStartEmulatorUsingAzuriteCLI', 'Failed to start emulator using the Azurite CLI. Check the output window for more details.'));
            });

            const maxTime: number = Date.now() + emulatorTimeoutInMillis;
            while (Date.now() < maxTime) {
                if (emulatorError && Date.now() > startTime + 1000) {
                    throw emulatorError;
                }

                await delay(500);
            }

            await ext.tree.refresh(ext.attachedStorageAccountsTreeItem);
        }
    } else {
        const installAzurite: vscode.MessageItem = { title: localize('installAzurite', 'Install Azurite') };
        const message: string = localize('mustInstallAzurite', 'You must install Azurite to use the Storage Emulator.');

        const result: vscode.MessageItem = await ext.ui.showWarningMessage(message, { modal: true }, installAzurite);
        if (result === installAzurite) {
            context.telemetry.properties.installAzuriteExtension = 'true';
            await vscode.commands.executeCommand('extension.open', 'Azurite.azurite');
        } else {
            throw new UserCancelledError();
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

export interface IChildProcWrapper {
    childProc?: cp.ChildProcess;
}
