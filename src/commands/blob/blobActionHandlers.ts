/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import { DialogResponses, IActionContext, parseError, UserCancelledError } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { ext } from '../../extensionVariables';
import { BlobDirectoryItem } from '../../tree/blob/BlobDirectoryItem';
import { BlobItem } from '../../tree/blob/BlobItem';
import { ISuppressMessageContext } from '../../tree/blob/BlobTreeItem';
import { createBlobClient } from '../../utils/blobUtils';
import { localize } from "../../utils/localize";
import { registerBranchCommand } from '../../utils/v2/commandUtils';

export function registerBlobActionHandlers(): void {
    registerBranchCommand("azureStorage.deleteBlob", deleteBlob);
    registerBranchCommand("azureStorage.deleteBlobDirectory", deleteBlobDirectory);
}

async function deleteBlob(context: ISuppressMessageContext, treeItem: BlobItem): Promise<void> {
    let result: vscode.MessageItem | undefined;
    if (!context.suppressMessage) {
        const message: string = `Are you sure you want to delete the blob '${treeItem.name}'?`;
        result = await vscode.window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    }
    if (result === DialogResponses.deleteResponse || context.suppressMessage) {
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(treeItem.context.storageRoot, treeItem.context.containerName, treeItem.blobPath);
        await blobClient.delete();
        // TODO: Refresh tree item (note: have to go all the way up to the container, as directories are "virtual")
    } else {
        throw new UserCancelledError();
    }

    // TODO: Re-enable this.
    // AzureStorageFS.fireDeleteEvent(this);
}

async function deleteBlobDirectory(context: ISuppressMessageContext, treeItem: BlobDirectoryItem): Promise<void> {
    if (!context.suppressMessage) {
        const message: string = localize('deleteBlobDir', "Are you sure you want to delete the blob directory '{0}' and all its contents?", treeItem.dirName);
        await context.ui.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    }

    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification }, async (progress) => {
        progress.report({ message: localize('deletingDirectory', 'Deleting directory "{0}"...', treeItem.dirName) });
        const errors: boolean = await deleteFolder(context, treeItem);

        // TODO: Refresh tree item (note: have to go all the way up to the container, as directories are "virtual")

        if (errors) {
            ext.outputChannel.appendLog('Please refresh the viewlet to see the changes made.');

            const viewOutput: vscode.MessageItem = { title: 'View Errors' };
            const errorMessage: string = `Errors occurred when deleting "${treeItem.dirName}".`;
            void vscode.window.showWarningMessage(errorMessage, viewOutput).then((result: vscode.MessageItem | undefined) => {
                if (result === viewOutput) {
                    ext.outputChannel.show();
                }
            });

            throw new Error(`Errors occurred when deleting "${treeItem.dirName}".`);
        }
    });

    // TODO: Re-enable this.
    //AzureStorageFS.fireDeleteEvent(this);
}

async function deleteFolder(context: IActionContext, treeItem: BlobDirectoryItem): Promise<boolean> {
    const dirPaths: BlobDirectoryItem[] = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let dirPath: BlobDirectoryItem | undefined = treeItem;
    let errors: boolean = false;

    while (dirPath) {
        // TODO: Can we do this without enumerating children?
        const children = await dirPath.getChildren();
        for (const child of children) {
            if (child instanceof BlobItem) {
                try {
                    await deleteBlob(<ISuppressMessageContext>{ ...context, suppressMessage: true }, child);
                } catch (error) {
                    ext.outputChannel.appendLog(`Cannot delete ${child.blobPath}. ${parseError(error).message}`);
                    errors = true;
                }
            } else if (child instanceof BlobDirectoryItem) {
                dirPaths.push(child);
            }
        }

        dirPath = dirPaths.pop();
    }

    return errors;
}
