/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem } from 'vscode';
import { ext } from '../extensionVariables';
import { localize } from '../utils/localize';

export async function attachStorageAccount(): Promise<void> {
    const attachEmulator: QuickPickItem = { label: localize('attachEmulator', 'Attach Emulator') };
    const attachWithConnectionString: QuickPickItem = { label: localize('attachWithConnectionString', 'Attach with Connection String...') };

    const attachPick: QuickPickItem = await ext.ui.showQuickPick(
        [attachEmulator, attachWithConnectionString],
        { placeHolder: localize('selectMethodToAttachStorageAccount', 'Select method to attach Storage Account...'), ignoreFocusOut: true }
    );

    if (attachPick === attachEmulator) {
        await ext.attachedStorageAccountsTreeItem.attachEmulator();
    } else {
        await ext.attachedStorageAccountsTreeItem.attachWithConnectionString();
    }
}
