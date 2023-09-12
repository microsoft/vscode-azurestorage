/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, IActionContext, IWizardOptions, nonNullProp } from '@microsoft/vscode-azext-utils';
import { basename } from "path";
import * as vscode from 'vscode';
import { BlobContainerTreeItem } from '../../tree/blob/BlobContainerTreeItem';
import { FileShareTreeItem } from '../../tree/fileShare/FileShareTreeItem';
import { createActivityContext } from '../../utils/activityUtils';
import { localize } from '../../utils/localize';
import { IAzCopyResolution } from '../transfers/azCopy/IAzCopyResolution';
import { GetFolderDestinationDirectoryStep } from './GetFolderDestinationDirectoryStep';
import { IUploadFolderWizardContext } from './IUploadFolderWizardContext';
import { UploadFolderStep } from './UploadFolderStep';

export async function uploadFolder(
    context: IActionContext,
    treeItem?: BlobContainerTreeItem | FileShareTreeItem,
    _selectedNodes?: AzExtTreeItem[],
    uri?: vscode.Uri,
    cancellationToken?: vscode.CancellationToken,
    destinationDirectory?: string
): Promise<IAzCopyResolution> {
    const wizardContext: IUploadFolderWizardContext = {
        ...context, ...await createActivityContext(), destinationDirectory, treeItem, uri,
        calledFromUploadToAzureStorage: uri !== undefined
    };
    const wizardOptions: IWizardOptions<IUploadFolderWizardContext> = {
        promptSteps: [new GetFolderDestinationDirectoryStep()],
        executeSteps: [new UploadFolderStep(cancellationToken)],
    };
    const wizard: AzureWizard<IUploadFolderWizardContext> = new AzureWizard(wizardContext, wizardOptions);
    await wizard.prompt();

    const nTreeItem: BlobContainerTreeItem | FileShareTreeItem = nonNullProp(wizardContext, "treeItem");
    const nUri: vscode.Uri = nonNullProp(wizardContext, "uri");
    wizardContext.activityTitle = localize('activityLogUploadFolder', 'Upload "{0}" folder to "{1}"', basename(nUri.path), nTreeItem.label);

    await wizard.execute();
    return wizardContext.resolution as IAzCopyResolution;
}
