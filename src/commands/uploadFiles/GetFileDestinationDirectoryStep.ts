/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { storageFilter } from '../../constants';
import { ext } from '../../extensionVariables';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../../tree/fileShare/FileShareTreeItem';
import { getDestinationDirectory, upload } from '../../utils/uploadUtils';
import { IUploadFilesWizardContext } from './IUploadFilesWizardContext';

export class GetFileDestinationDirectoryStep extends AzureWizardPromptStep<IUploadFilesWizardContext> {
    public async prompt(context: IUploadFilesWizardContext): Promise<void> {
        context.destinationDirectory = await getDestinationDirectory(context, context.destinationDirectory);
        if (context.uris === undefined) {
            context.uris = await context.ui.showOpenDialog(
                {
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                    defaultUri: ext.lastUriUpload,
                    filters: {
                        "All files": ['*']
                    },
                    openLabel: upload
                }
            );
        }
        context.treeItem = context.treeItem || await ext.rgApi.pickAppResource<BlobContainerTreeItem | FileShareTreeItem>(context, {
            filter: storageFilter,
            expectedChildContextValue: [BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue]
        });
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
