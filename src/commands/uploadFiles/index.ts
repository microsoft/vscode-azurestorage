/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizard, IActionContext, IWizardOptions } from "@microsoft/vscode-azext-utils";
import { CancellationToken, Uri } from "vscode";
import { NotificationProgress } from "../../constants";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { createActivityContext } from "../../utils/activityUtils";
import { IAzCopyResolution } from "../azCopy/IAzCopyResolution";
import { GetDestinationDirectoryStep } from './GetDestinationDirectoryStep';
import { IUploadFilesWizardContext } from "./IUploadFilesWizardContext";
import { UploadFilesStep } from "./UploadFilesStep";

export * from "./GetDestinationDirectoryStep";
export * from "./IExistingFileContext";
export * from "./IUploadFilesWizardContext";
export * from "./UploadFilesStep";

export async function uploadFiles(
    context: IActionContext,
    treeItem?: BlobContainerTreeItem | FileShareTreeItem,
    uris?: Uri[],
    notificationProgress?: NotificationProgress,
    cancellationToken?: CancellationToken,
    destinationDirectory?: string
): Promise<IAzCopyResolution> {
    const wizardContext: IUploadFilesWizardContext = {
        ...context, ...await createActivityContext(), destinationDirectory,
    };
    const wizardOptions: IWizardOptions<IUploadFilesWizardContext> = {
        title: "Uploading File",
        promptSteps: [new GetDestinationDirectoryStep()],
        executeSteps: [new UploadFilesStep(treeItem, uris, notificationProgress, cancellationToken)],
    };
    const wizard: AzureWizard<IUploadFilesWizardContext> = new AzureWizard(wizardContext, wizardOptions);
    await wizard.prompt();
    await wizard.execute();
    return wizardContext.resolution as IAzCopyResolution;
}
