/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, IActionContext, IParsedError, nonNullValue, parseError } from "@microsoft/vscode-azext-utils";
import { CancellationToken, ProgressLocation, Uri, window } from "vscode";
import { NotificationProgress, storageFilter } from '../../constants';
import { ext } from "../../extensionVariables";
import { BlobContainerTreeItem } from "../../tree/blob/BlobContainerTreeItem";
import { FileShareTreeItem } from "../../tree/fileShare/FileShareTreeItem";
import { AzExtFsExtra } from "../../utils/AzExtFsExtra";
import { isAzCopyError, multipleAzCopyErrorsMessage, throwIfCanceled } from "../../utils/errorUtils";
import { checkCanUpload, convertLocalPathToRemotePath, getUploadingMessage, outputAndCopyUploadedFileUrls, OverwriteChoice, upload } from "../../utils/uploadUtils";
import { IAzCopyResolution } from "../azCopy/IAzCopyResolution";
import { IExistingFileContext } from "./IExistingFileContext";
import { IUploadFilesWizardContext } from './IUploadFilesWizardContext';

let lastUriUpload: Uri | undefined;

export class UploadFilesStep extends AzureWizardExecuteStep<IUploadFilesWizardContext> {
    public priority: number = 100;
    public treeItem?: BlobContainerTreeItem | FileShareTreeItem;
    public uris?: Uri[];
    public notificationProgress?: NotificationProgress;
    public cancellationToken?: CancellationToken;

    public constructor(treeItem?: BlobContainerTreeItem | FileShareTreeItem, uris?: Uri[], notificationProgress?: NotificationProgress, cancellationToken?: CancellationToken) {
        super();
        this.treeItem = treeItem;
        this.uris = uris;
        this.notificationProgress = notificationProgress;
        this.cancellationToken = cancellationToken;
    }

    public async execute(context: IUploadFilesWizardContext, _progress: NotificationProgress): Promise<void> {
        const calledFromUploadToAzureStorage: boolean = this.uris !== undefined;
        if (this.uris === undefined) {
            this.uris = await context.ui.showOpenDialog(
                {
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: true,
                    defaultUri: lastUriUpload,
                    filters: {
                        "All files": ['*']
                    },
                    openLabel: upload
                }
            );
        }

        this.treeItem = this.treeItem || await ext.rgApi.pickAppResource<BlobContainerTreeItem | FileShareTreeItem>(context, {
            filter: storageFilter,
            expectedChildContextValue: [BlobContainerTreeItem.contextValue, FileShareTreeItem.contextValue]
        });
        let urisToUpload: Uri[] = [];
        const fileEndings: string[] = [];
        if (!calledFromUploadToAzureStorage) {
            const overwriteChoice: { choice: OverwriteChoice | undefined } = { choice: undefined };
            for (const uri of this.uris) {
                const destPath: string = convertLocalPathToRemotePath(uri.fsPath, context.destinationDirectory as string);
                if (!await AzExtFsExtra.isDirectory(uri) && await checkCanUpload(context, destPath, overwriteChoice, this.treeItem)) {
                    // Don't allow directories to sneak in https://github.com/microsoft/vscode-azurestorage/issues/803
                    urisToUpload.push(uri);
                    fileEndings.push(destPath);
                }
            }
        } else {
            urisToUpload = this.uris;
        }

        if (!urisToUpload.length) {
            // No URIs to upload and no errors to report
            context.resolution = { errors: [] };
        }

        if (this.notificationProgress && this.cancellationToken) {
            context.resolution = await uploadFilesStepHelper(context, this.treeItem, urisToUpload, this.notificationProgress, this.cancellationToken, <string>context.destinationDirectory, calledFromUploadToAzureStorage);
        } else {
            const title: string = getUploadingMessage(this.treeItem.label);
            const resolution: IAzCopyResolution = await window.withProgress({ cancellable: true, location: ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
                return await uploadFilesStepHelper(context, nonNullValue(this.treeItem as BlobContainerTreeItem | FileShareTreeItem), urisToUpload, newNotificationProgress, newCancellationToken, nonNullValue(<string>context.destinationDirectory), calledFromUploadToAzureStorage);
            });

            if (!calledFromUploadToAzureStorage) {
                outputAndCopyUploadedFileUrls(this.treeItem.getUrl(), fileEndings);
            }

            context.resolution = resolution;
        }
    }

    public shouldExecute(_context: IUploadFilesWizardContext): boolean {
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
    lastUriUpload = uris[0];
    const resolution: IAzCopyResolution = { errors: [] };
    for (const uri of uris) {
        throwIfCanceled(cancellationToken, context.telemetry.properties, 'uploadFiles');

        const localFilePath: string = uri.fsPath;
        const remoteFilePath: string = convertLocalPathToRemotePath(localFilePath, destinationDirectory);
        const id: string = `${treeItem.fullId}/${remoteFilePath}`;
        const result = await treeItem.treeDataProvider.findTreeItem(id, context);
        try {
            if (result) {
                // A treeItem for this file already exists, no need to do anything with the tree, just upload
                await treeItem.uploadLocalFile(context, localFilePath, remoteFilePath, notificationProgress, cancellationToken);
            } else {
                await treeItem.createChild(<IExistingFileContext>{ ...context, remoteFilePath, localFilePath });
            }
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
