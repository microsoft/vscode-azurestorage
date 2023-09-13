/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizard, AzureWizardPromptStep, IActionContext } from "@microsoft/vscode-azext-utils";
import { ITransferSrcOrDstTreeItem } from "../tree/ITransferSrcOrDstTreeItem";
import { createActivityContext } from "../utils/activityUtils";
import { localize } from "../utils/localize";
import { DestinationPromptStep } from "./downloadFiles/DestinationPromptStep";
import { DownloadFilesStep } from "./downloadFiles/DownloadFilesStep";
import { GetAzCopyDownloadsStep } from "./downloadFiles/GetAzCopyDownloadsStep";
import { IDownloadWizardContext } from "./downloadFiles/IDownloadWizardContext";
import { SasUrlPromptStep } from "./downloadFiles/SasUrlPromptStep";

export interface IAzCopyDownload {
    remoteFileName: string;
    remoteFilePath: string;
    localFilePath: string;
    isDirectory: boolean;
    resourceUri: string;
    sasToken: string;
}

export async function download(context: IActionContext, treeItems?: ITransferSrcOrDstTreeItem[]): Promise<void> {
    const wizardContext: IDownloadWizardContext = { ...context, ...(await createActivityContext()) };
    const promptSteps: AzureWizardPromptStep<IDownloadWizardContext>[] = [new DestinationPromptStep()];
    if (!treeItems) {
        promptSteps.push(new SasUrlPromptStep());
    } else {
        wizardContext.treeItems = treeItems;
    }

    const wizard: AzureWizard<IDownloadWizardContext> = new AzureWizard(wizardContext, {
        promptSteps,
        executeSteps: [new GetAzCopyDownloadsStep(), new DownloadFilesStep()],
        title: localize('download', 'Download Files')
    });

    await wizard.prompt();
    await wizard.execute();
}

export async function downloadSasUrl(context: IActionContext): Promise<void> {
    return await download(context);
}

export async function downloadTreeItems(context: IActionContext, treeItem: ITransferSrcOrDstTreeItem, treeItems?: ITransferSrcOrDstTreeItem[]): Promise<void> {
    treeItems ??= [treeItem];
    await download(context, treeItems);
}
