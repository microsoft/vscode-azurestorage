/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import * as vscode from "vscode";
import { storageFilter } from '../../constants';
import { ext } from '../../extensionVariables';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../../tree/fileShare/FileShareTreeItem';
import { getDestinationDirectory, upload } from '../../utils/uploadUtils';
import { IUploadFolderWizardContext } from './IUploadFolderWizardContext';

export class GetFolderDestinationDirectoryStep extends AzureWizardPromptStep<IUploadFolderWizardContext> {
    public async prompt(context: IUploadFolderWizardContext): Promise<void> {
        if (context.uri === undefined) {
            context.uri = (await context.ui.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                defaultUri: vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 ? vscode.workspace.workspaceFolders[0].uri : undefined,
                openLabel: upload
            }))[0];
        }
        context.treeItem = context.treeItem || await ext.rgApi.pickAppResource<BlobContainerTreeItem | FileShareTreeItem>(context, {
            filter: storageFilter,
            expectedChildContextValue: [BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue]
        });
        context.destinationDirectory = await getDestinationDirectory(context, context.destinationDirectory);
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
