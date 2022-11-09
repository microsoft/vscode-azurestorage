/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageShare from '@azure/storage-file-share';
import * as vscode from 'vscode';
import { IActionContext, UserCancelledError } from '@microsoft/vscode-azext-utils';
import { FileShareGroupItem } from '../../tree/fileShare/FileShareGroupItem';
import { FileShareGroupTreeItem } from '../../tree/fileShare/FileShareGroupTreeItem';
import { registerBranchCommand } from '../../utils/v2/commandUtils';
import { pickForCreateChildNode } from '../commonTreeCommands';

function validateFileShareName(name: string): string | undefined | null {
    const validLength = { min: 3, max: 63 };

    if (!name) {
        return "Share name cannot be empty";
    }
    if (name.indexOf(" ") >= 0) {
        return "Share name cannot contain spaces";
    }
    if (name.length < validLength.min || name.length > validLength.max) {
        return `Share name must contain between ${validLength.min} and ${validLength.max} characters`;
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
        return 'Share name can only contain lowercase letters, numbers and hyphens';
    }
    if (/--/.test(name)) {
        return 'Share name cannot contain two hyphens in a row';
    }
    if (/(^-)|(-$)/.test(name)) {
        return 'Share name cannot begin or end with a hyphen';
    }

    return undefined;
}

const minQuotaGB = 1;
const maxQuotaGB = 5120;

function validateQuota(input: string): string | undefined {
    try {
        const value = Number(input);
        if (value < minQuotaGB || value > maxQuotaGB) {
            return `Value must be between ${minQuotaGB} and ${maxQuotaGB}`;
        }
    } catch (err) {
        return "Input must be a number";
    }
    return undefined;
}

export function registerFileShareGroupActionHandlers(): void {
    registerBranchCommand("azureStorage.createFileShare", createFileShare);
}

export async function createFileShare(context: IActionContext, treeItem?: FileShareGroupItem): Promise<void> {
    const pickedTreeItem = await pickForCreateChildNode(context, FileShareGroupTreeItem.contextValue, treeItem);

    const shareName = await context.ui.showInputBox({
        placeHolder: 'Enter a name for the new file share',
        validateInput: validateFileShareName
    });

    if (shareName) {
        const quotaGB = await context.ui.showInputBox({
            prompt: `Specify quota (in GB, between ${minQuotaGB} and ${maxQuotaGB}), to limit total storage size`,
            value: maxQuotaGB.toString(),
            validateInput: validateQuota
        });

        if (quotaGB) {
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
                progress.report({ message: `Azure Storage: Creating file share '${shareName}'` });
                const shareServiceClient: azureStorageShare.ShareServiceClient = pickedTreeItem.storageRoot.createShareServiceClient();
                await shareServiceClient.createShare(shareName, { quota: Number(quotaGB) });
            });
            pickedTreeItem.notifyChanged();
        }
    }

    throw new UserCancelledError();
}
