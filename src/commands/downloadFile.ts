/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FromToOption } from "@azure-tools/azcopy-node";
import { AzureWizard, AzureWizardPromptStep, IActionContext } from "@microsoft/vscode-azext-utils";
import { IDownloadableTreeItem } from "../tree/IDownloadableTreeItem";
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
    fromTo: FromToOption;
    isDirectory: boolean;
    resourceUri: string;
    sasToken: string;
}

export async function download(context: IDownloadWizardContext, treeItems?: IDownloadableTreeItem[]): Promise<void> {
    const promptSteps: AzureWizardPromptStep<IDownloadWizardContext>[] = [new DestinationPromptStep()];
    if (!treeItems) {
        promptSteps.push(new SasUrlPromptStep());
    } else {
        context.treeItems = treeItems;
    }

    const wizard: AzureWizard<IDownloadWizardContext> = new AzureWizard(context, {
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

export async function downloadTreeItems(context: IActionContext, treeItem: IDownloadableTreeItem, treeItems?: IDownloadableTreeItem[]): Promise<void> {
    treeItems ??= [treeItem];
    await download(context, treeItems);
}
