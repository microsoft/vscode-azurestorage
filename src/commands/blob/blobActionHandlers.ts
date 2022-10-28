/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azureStorageBlob from "@azure/storage-blob";
import { DialogResponses, IActionContext, registerCommand, UserCancelledError } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobItem } from '../../tree/blob/BlobItem';
import { ISuppressMessageContext } from '../../tree/blob/BlobTreeItem';
import { createBlobClient } from '../../utils/blobUtils';
import { registerBranchCommand } from '../../utils/v2/commandUtils';

export function registerBlobActionHandlers(): void {
    registerBranchCommand("azureStorage.deleteBlob", deleteBlob);
    registerCommand("azureStorage.deleteBlobDirectory", async (context: IActionContext, treeItem: BlobDirectoryTreeItem) => await treeItem.deleteTreeItem(context));
}

export async function deleteBlob(context: ISuppressMessageContext, treeItem: BlobItem): Promise<void> {
    let result: vscode.MessageItem | undefined;
    if (!context.suppressMessage) {
        const message: string = `Are you sure you want to delete the blob '${treeItem.name}'?`;
        result = await vscode.window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
    }
    if (result === DialogResponses.deleteResponse || context.suppressMessage) {
        const blobClient: azureStorageBlob.BlobClient = createBlobClient(treeItem.context.storageRoot, treeItem.context.containerName, treeItem.blobPath);
        await blobClient.delete();
        // TODO: Refresh tree item
    } else {
        throw new UserCancelledError();
    }

    // TODO: Re-enable this.
    // AzureStorageFS.fireDeleteEvent(this);
}
