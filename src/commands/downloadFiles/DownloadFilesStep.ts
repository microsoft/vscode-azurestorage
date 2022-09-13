/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILocalLocation, IRemoteSasLocation } from "@azure-tools/azcopy-node";
import { AzExtFsExtra, AzureWizardExecuteStep, IActionContext } from "@microsoft/vscode-azext-utils";
import { CancellationToken } from "vscode";
import { NotificationProgress } from "../../constants";
import { ext } from "../../extensionVariables";
import { TransferProgress } from "../../TransferProgress";
import { checkCanOverwrite } from "../../utils/checkCanOverwrite";
import { isSubpath } from "../../utils/fs";
import { localize } from "../../utils/localize";
import { OverwriteChoice } from "../../utils/uploadUtils";
import { createAzCopyLocalLocation, createAzCopyRemoteLocation } from "../azCopy/azCopyLocations";
import { azCopyTransfer } from "../azCopy/azCopyTransfer";
import { IAzCopyDownload } from "../downloadFile";
import { IDownloadWizardContext } from "./IDownloadWizardContext";

export class DownloadFilesStep extends AzureWizardExecuteStep<IDownloadWizardContext> {
    public priority: number = 300;

    public constructor(private readonly cancellationToken?: CancellationToken) {
        super();
    }

    public async execute(context: IDownloadWizardContext, progress: NotificationProgress): Promise<void> {
        const azCopyDownloads: IAzCopyDownload[] = await this.checkForDuplicates(context);

        if (azCopyDownloads.length === 0) {
            // Nothing to download
            return;
        }

        const message: string = localize('downloadingTo', 'Downloading to "{0}"...', context.destinationFolder);
        ext.outputChannel.appendLog(message);
        progress.report({ message });

        for (const azCopyDownload of azCopyDownloads) {
            const src: IRemoteSasLocation = createAzCopyRemoteLocation(azCopyDownload.resourceUri, azCopyDownload.sasToken, azCopyDownload.remoteFilePath, azCopyDownload.isDirectory);
            const dst: ILocalLocation = createAzCopyLocalLocation(azCopyDownload.localFilePath);
            const units: 'files' | 'bytes' = azCopyDownload.isDirectory ? 'files' : 'bytes';
            const transferProgress: TransferProgress = new TransferProgress(units, azCopyDownload.remoteFileName);
            await azCopyTransfer(context, azCopyDownload.fromTo, src, dst, transferProgress, progress, this.cancellationToken);
            if (azCopyDownload.isDirectory) {
                await AzExtFsExtra.ensureDir(azCopyDownload.localFilePath);
            }
        }

        const downloaded: string = localize('successfullyDownloaded', 'Successfully downloaded to "{0}".', context.destinationFolder);
        progress.report({ message: downloaded });
        ext.outputChannel.appendLog(downloaded);
    }

    public shouldExecute(wizardContext: IDownloadWizardContext): boolean {
        return !!wizardContext.destinationFolder;
    }

    private async checkForDuplicates(context: IDownloadWizardContext): Promise<IAzCopyDownload[]> {
        let hasParent: boolean;
        const overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };

        const allFolderDownloads = context.allFolderDownloads ?? [];
        const allFileDownloads = context.allFileDownloads ?? [];

        const foldersToDownload: IAzCopyDownload[] = [];
        const filesToDownload: IAzCopyDownload[] = [];

        // Only download folders and files if their containing folder isn't already being downloaded.
        for (const folderDownload of allFolderDownloads) {
            hasParent = false;
            for (const parentFolderDownload of allFolderDownloads) {
                if (folderDownload !== parentFolderDownload && isSubpath(parentFolderDownload.remoteFilePath, folderDownload.remoteFilePath)) {
                    hasParent = true;
                    break;
                }
            }

            if (!hasParent && await this.checkCanDownload(context, folderDownload.localFilePath, overwriteChoice)) {
                foldersToDownload.push(folderDownload);
            }
        }

        for (const fileDownload of allFileDownloads) {
            hasParent = false;
            for (const parentFolderDownload of allFolderDownloads) {
                if (isSubpath(parentFolderDownload.remoteFilePath, fileDownload.remoteFilePath)) {
                    hasParent = true;
                    break;
                }
            }

            if (!hasParent && await this.checkCanDownload(context, fileDownload.localFilePath, overwriteChoice)) {
                filesToDownload.push(fileDownload);
            }
        }

        return [...foldersToDownload, ...filesToDownload];
    }

    private async checkCanDownload(context: IActionContext, destPath: string, overwriteChoice: { choice: OverwriteChoice | undefined }): Promise<boolean> {
        return await checkCanOverwrite(context, destPath, overwriteChoice, async () => await AzExtFsExtra.pathExists(destPath));
    }
}
