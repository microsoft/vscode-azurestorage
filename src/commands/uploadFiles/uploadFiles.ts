/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizard, IActionContext, IWizardOptions, nonNullProp } from "@microsoft/vscode-azext-utils";
import { basename } from "path";
import { CancellationToken, Uri } from "vscode";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { localize } from "../../utils/localize";
import { IAzCopyResolution } from "../azCopy/IAzCopyResolution";
import { GetDestinationDirectoryStep } from './GetDestinationDirectoryStep';
import { IUploadFilesWizardContext } from "./IUploadFilesWizardContext";
import { UploadFilesStep } from "./UploadFilesStep";

export async function uploadFiles(
    context: IActionContext,
    treeItem?: BlobContainerTreeItem | FileShareTreeItem,
    uris?: Uri[],
    cancellationToken?: CancellationToken,
    destinationDirectory?: string
): Promise<IAzCopyResolution> {
    const wizardContext: IUploadFilesWizardContext = {
        ...context, ...await createActivityContext(), destinationDirectory, treeItem, uris,
        calledFromUploadToAzureStorage: !!uris?.length
    };
    const wizardOptions: IWizardOptions<IUploadFilesWizardContext> = {
        promptSteps: [new GetDestinationDirectoryStep()],
        executeSteps: [new UploadFilesStep(cancellationToken)],
    };
    const wizard: AzureWizard<IUploadFilesWizardContext> = new AzureWizard(wizardContext, wizardOptions);
    await wizard.prompt();

    const nUris: Uri[] = nonNullProp(wizardContext, "uris");
    const nTreeItem: BlobContainerTreeItem | FileShareTreeItem = nonNullProp(wizardContext, "treeItem");
    if (nUris.length === 1) {
        wizardContext.activityTitle = localize('activityLogUploadFiles', `Upload "${basename(nUris[0].path)}" to "${nTreeItem.label}"`);
    } else {
        wizardContext.activityTitle = localize('activityLogUploadFiles', `Upload ${nUris.length} files to "${nTreeItem.label}"`);
    }

    await wizard.execute();
    return wizardContext.resolution as IAzCopyResolution;
}
