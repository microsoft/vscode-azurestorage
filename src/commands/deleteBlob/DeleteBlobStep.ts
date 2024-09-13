/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { BlobClient } from "@azure/storage-blob";

import { AzureWizardExecuteStep, nonNullProp } from "@microsoft/vscode-azext-utils";
import { Progress, window } from "vscode";
import { ext } from "../../extensionVariables";
import { createBlobClient } from "../../utils/blobUtils";
import { localize } from "../../utils/localize";
import { IDeleteBlobWizardContext } from "./IDeleteBlobWizardContext";

export class DeleteBlobStep extends AzureWizardExecuteStep<IDeleteBlobWizardContext> {
    public priority: number = 100;

    public async execute(wizardContext: IDeleteBlobWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {
        const blobName = nonNullProp(wizardContext, 'blobName');
        const blob = nonNullProp(wizardContext, 'blob');
        const deletingBlob: string = localize('deletingBlob', 'Deleting blob "{0}"...', blobName);
        ext.outputChannel.appendLog(deletingBlob);
        progress.report({ message: deletingBlob });
        const blobClient: BlobClient = await createBlobClient(blob.root, blob.container.name, blob.blobPath);
        await blobClient.delete();
        const deleteSuccessful: string = localize('successfullyDeletedBlob', 'Successfully deleted blob "{0}".', blobName);
        ext.outputChannel.appendLog(deleteSuccessful);
        if (!wizardContext.suppressNotification) {
            void window.showInformationMessage(deleteSuccessful);
        }
    }

    public shouldExecute(): boolean {
        return true;
    }
}
