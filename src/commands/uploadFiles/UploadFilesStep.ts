/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtFsExtra, AzureWizardExecuteStep, IActionContext, IParsedError, nonNullValue, parseError } from "@microsoft/vscode-azext-utils";
import { CancellationToken, ProgressLocation, Uri, window } from "vscode";
import { NotificationProgress } from '../../constants';
import { ext } from "../../extensionVariables";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { refreshTreeItem } from "../../tree/refreshTreeItem";
import { isAzCopyError, multipleAzCopyErrorsMessage, throwIfCanceled } from "../../utils/errorUtils";
import { OverwriteChoice, checkCanUpload, convertLocalPathToRemotePath, getUploadingMessage, outputAndCopyUploadedFileUrls } from "../../utils/uploadUtils";
import { IAzCopyResolution } from "../transfers/azCopy/IAzCopyResolution";
import { IUploadFilesWizardContext } from './IUploadFilesWizardContext';

export class UploadFilesStep extends AzureWizardExecuteStep<IUploadFilesWizardContext> {
    public priority: number = 100;

    public constructor(private readonly cancellationToken?: CancellationToken) {
        super();
    }

    public async execute(context: Required<IUploadFilesWizardContext>, notificationProgress: NotificationProgress): Promise<void> {
        let urisToUpload: Uri[] = [];
        const fileEndings: string[] = [];
        if (!context.calledFromUploadToAzureStorage) {
            const overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };
            for (const uri of context.uris) {
                const destPath: string = convertLocalPathToRemotePath(uri.fsPath, context.destinationDirectory);
                if (!await AzExtFsExtra.isDirectory(uri) && await checkCanUpload(context, destPath, overwriteChoice, context.treeItem)) {
                    // Don't allow directories to sneak in https://github.com/microsoft/vscode-azurestorage/issues/803
                    urisToUpload.push(uri);
                    fileEndings.push(destPath);
                }
            }
        } else {
            urisToUpload = context.uris;
        }

        if (!urisToUpload.length) {
            // No URIs to upload and no errors to report
            context.resolution = { errors: [] };
            return;
        }

        if (notificationProgress && this.cancellationToken) {
            context.resolution = await uploadFilesStepHelper(context, context.treeItem, urisToUpload, notificationProgress, this.cancellationToken, context.destinationDirectory, context.calledFromUploadToAzureStorage);
        } else {
            const title: string = getUploadingMessage(context.treeItem.label);
            const resolution: IAzCopyResolution = await window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
                return await uploadFilesStepHelper(context, nonNullValue(context.treeItem), urisToUpload, newNotificationProgress, newCancellationToken, nonNullValue(context.destinationDirectory), context.calledFromUploadToAzureStorage);
            });

            if (!context.calledFromUploadToAzureStorage) {
                outputAndCopyUploadedFileUrls(context.treeItem.getUrl(), fileEndings);
            }
            await refreshTreeItem(context, context.treeItem);
            context.resolution = resolution;
        }
    }

    public shouldExecute(): boolean {
        return true;
    }
}

async function uploadFilesStepHelper(
    context: IActionContext,
    treeItem: BlobContainerTreeItem | FileShareTreeItem,
    uris: Uri[],
    notificationProgress: NotificationProgress,
    cancellationToken: CancellationToken,
    destinationDirectory: string,
    calledFromUploadToAzureStorage: boolean,
): Promise<IAzCopyResolution> {
    ext.lastUriUpload = uris[0];
    const resolution: IAzCopyResolution = { errors: [] };
    for (const uri of uris) {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'uploadFiles');

        const localFilePath: string = uri.fsPath;
        const remoteFilePath: string = convertLocalPathToRemotePath(localFilePath, destinationDirectory);
        try {
            await treeItem.uploadLocalFile(context, localFilePath, remoteFilePath, notificationProgress, cancellationToken);
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            if (isAzCopyError(parsedError)) {
                resolution.errors.push(parsedError);
            } else {
                throw error;
            }
        }
    }

    if (calledFromUploadToAzureStorage || resolution.errors.length === 0) {
        // No need to throw any errors from this function
        return resolution;
    } else if (resolution.errors.length === 1) {
        throw resolution.errors[0];
    } else {
        throw new Error(multipleAzCopyErrorsMessage);
    }
}
