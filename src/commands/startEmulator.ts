/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { emulatorTimeoutMS } from '../constants';
import { ext } from "../extensionVariables";
import { isAzuriteCliInstalled, isAzuriteExtensionInstalled, warnAzuriteNotInstalled } from '../utils/azuriteUtils';
import { cpUtils } from '../utils/cpUtils';

export async function startEmulator(context: IActionContext, emulatorType: EmulatorType): Promise<void> {
    if (isAzuriteExtensionInstalled()) {
        // Use the Azurite extension
        await vscode.commands.executeCommand(`azurite.start_${emulatorType}`);
        await ext.rgApi.workspaceResourceTree.refresh(context, ext.attachedStorageAccountsTreeItem);
    } else if (await isAzuriteCliInstalled()) {
        // Use the Azurite CLI

        // This task will remain active as long as the user keeps the emulator running. Only show an error if it happens in the first three seconds
        const emulatorTask: Promise<string> = cpUtils.executeCommand(ext.outputChannel, undefined, `azurite-${emulatorType}`);
        ext.outputChannel.show();
        await new Promise((resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
            emulatorTask.catch(reject);
            setTimeout(resolve, emulatorTimeoutMS);
        });

        await ext.rgApi.workspaceResourceTree.refresh(context, ext.attachedStorageAccountsTreeItem);
    } else {
        warnAzuriteNotInstalled(context);
    }
}

export enum EmulatorType {
    blob = 'blob',
    queue = 'queue',
    table = 'table'
}
