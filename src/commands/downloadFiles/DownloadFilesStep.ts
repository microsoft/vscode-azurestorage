/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep } from "@microsoft/vscode-azext-utils";
import { CancellationToken } from "vscode";
import { NotificationProgress } from "../../constants";
import { downloadFoldersAndFiles } from "../transfers/transfers";
import { IDownloadWizardContext } from "./IDownloadWizardContext";

export class DownloadFilesStep extends AzureWizardExecuteStep<IDownloadWizardContext> {
    public priority: number = 300;

    public constructor(private readonly cancellationToken?: CancellationToken) {
        super();
    }

    public async execute(context: IDownloadWizardContext, notificationProgress: NotificationProgress): Promise<void> {
        await downloadFoldersAndFiles(context, context.allFolderDownloads ?? [], context.allFileDownloads ?? [], notificationProgress, this.cancellationToken);
    }

    public shouldExecute(wizardContext: IDownloadWizardContext): boolean {
        return !!wizardContext.destinationFolder;
    }
}
