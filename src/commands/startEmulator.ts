/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { azuriteExtensionPrefix, azuriteLooseSetting, emulatorTimeoutMS } from '../constants';
import { ext } from "../extensionVariables";
import { isAzuriteCliInstalled, isAzuriteExtensionInstalled, warnAzuriteNotInstalled } from '../utils/azuriteUtils';
import { cpUtils } from '../utils/cpUtils';
import { updateWorkspaceSetting } from '../utils/settingsUtils';

export async function startEmulator(context: IActionContext, emulatorType: EmulatorType): Promise<void> {
    if (isAzuriteExtensionInstalled()) {
        // Use the Azurite extension

        // Enable loose mode (workaround for https://github.com/Azure/Azurite/issues/676)
        await updateWorkspaceSetting(azuriteLooseSetting, true, '', azuriteExtensionPrefix);

        await vscode.commands.executeCommand(`${azuriteExtensionPrefix}.start_${emulatorType}`);
        await ext.tree.refresh(context, ext.attachedStorageAccountsTreeItem);
    } else if (await isAzuriteCliInstalled()) {
        // Use the Azurite CLI

        // This task will remain active as long as the user keeps the emulator running. Only show an error if it happens in the first three seconds
        // Enable loose mode (workaround for https://github.com/Azure/Azurite/issues/676)
        const emulatorTask: Promise<string> = cpUtils.executeCommand(ext.outputChannel, undefined, `azurite-${emulatorType} --${azuriteLooseSetting}`);
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

export enum EmulatorType {
    blob = 'blob',
    queue = 'queue'
}
