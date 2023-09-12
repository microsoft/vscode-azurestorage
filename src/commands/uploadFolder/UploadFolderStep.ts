/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, IParsedError, nonNullValue, parseError } from "@microsoft/vscode-azext-utils";
import * as vscode from "vscode";
import { NotificationProgress } from '../../constants';
import { refreshTreeItem } from "../../tree/refreshTreeItem";
import { isAzCopyError } from "../../utils/errorUtils";
import { checkCanUpload, convertLocalPathToRemotePath, getUploadingMessageWithSource, showUploadSuccessMessage, uploadLocalFolder } from "../../utils/uploadUtils";
import { IAzCopyResolution } from "../transfers/azCopy/IAzCopyResolution";
import { IUploadFolderWizardContext } from "./IUploadFolderWizardContext";

export class UploadFolderStep extends AzureWizardExecuteStep<IUploadFolderWizardContext> {
    public priority: number = 100;

    public constructor(private readonly cancellationToken?: vscode.CancellationToken) {
        super();
    }

    public async execute(context: Required<IUploadFolderWizardContext>, notificationProgress: NotificationProgress): Promise<void> {
        const sourcePath: string = context.uri.fsPath;
        const destPath: string = convertLocalPathToRemotePath(sourcePath, context.destinationDirectory);
        const resolution: IAzCopyResolution = { errors: [] };
        if (!context.calledFromUploadToAzureStorage && !(await checkCanUpload(context, destPath, { choice: undefined }, context.treeItem))) {
            // Don't upload this folder
            context.resolution = resolution;
            return;
        }

        try {
            if (notificationProgress && this.cancellationToken) {
                await uploadLocalFolder(context, context.treeItem, sourcePath, destPath, notificationProgress, this.cancellationToken, destPath);
            } else {
                const title: string = getUploadingMessageWithSource(sourcePath, context.treeItem.label);
                await vscode.window.withProgress({ cancellable: true, location: vscode.ProgressLocation.Notification, title }, async (newNotificationProgress, newCancellationToken) => {
                    await uploadLocalFolder(context, nonNullValue(context.treeItem), sourcePath, nonNullValue(destPath), newNotificationProgress, newCancellationToken, destPath);
                });
            }
        } catch (error) {
            const parsedError: IParsedError = parseError(error);
            if (context.calledFromUploadToAzureStorage && isAzCopyError(parsedError)) {
                // `uploadToAzureStorage` will deal with this error
                resolution.errors.push(parsedError);
            } else {
                throw error;
            }
        }

        if (!context.calledFromUploadToAzureStorage) {
            showUploadSuccessMessage(context.treeItem.label);
        }

        await refreshTreeItem(context, context.treeItem);
        context.resolution = resolution;
    }

    public shouldExecute(): boolean {
        return true;
    }
}
