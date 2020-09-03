/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { BlobContainerTreeItem } from '../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../tree/fileShare/FileShareTreeItem';
import { localize } from '../utils/localize';
import { getUploadingMessage, uploadFiles } from '../utils/uploadUtils';
import { selectWorkspaceItem } from '../utils/workspaceUtils';

export async function uploadToAzureStorage(actionContext: IActionContext, target?: vscode.Uri): Promise<void> {
    let resourcePath: string;
    if (target) {
        if (target.scheme === 'azurestorage') {
            throw new Error(localize('cannotUploadToAzureFromAzureResource', 'Cannot upload to Azure from an Azure resource.'));
        }

        resourcePath = target.fsPath;
    } else {
        resourcePath = await selectWorkspaceItem(
            ext.ui,
            localize('selectResourceToUpload', 'Select resource to upload'),
            {
                canSelectFiles: true,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
                openLabel: localize('select', 'Select')
            });
    }

    let treeItem: BlobContainerTreeItem | FileShareTreeItem = await ext.tree.showTreeItemPicker([BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue], actionContext);
    await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title: getUploadingMessage(treeItem.label, resourcePath) }, async (notificationProgress, cancellationToken) => {
        if ((await fse.stat(resourcePath)).isDirectory()) {
            const message: string = localize('uploadWillOverwrite', 'Uploading "{0}" will overwrite any existing resources with the same name.', resourcePath);
            await ext.ui.showWarningMessage(message, { modal: true }, { title: localize('upload', 'Upload') });

            ext.outputChannel.appendLog(uploading);
            // AzCopy recognizes folders as a resource when uploading to file shares. So only set `countFoldersAsResources=true` in that case
            await uploadFiles(actionContext, treeItem, resourcePath, undefined, notificationProgress, cancellationToken, undefined, treeItem instanceof FileShareTreeItem);
            ext.outputChannel.appendLog(localize('success', 'Successfully uploaded to "{0}".', treeItem.label));
        } else {
            await treeItem.uploadLocalFile(actionContext, resourcePath);
        }
    });
}
