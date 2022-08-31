/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizardExecuteStep, nonNullProp, parseError } from "@microsoft/vscode-azext-utils";
import { MessageItem, Progress, window } from "vscode";
import { ext } from "../../extensionVariables";
import { BlobDirectoryTreeItem } from "../../tree/blob/BlobDirectoryTreeItem";
import { BlobTreeItem, ISuppressMessageContext } from "../../tree/blob/BlobTreeItem";
import { localize } from "../../utils/localize";
import { IDeleteBlobDirectoryWizardContext } from "./IDeleteBlobDirectoryWizardContext";

export class DeleteBlobDirectoryStep extends AzureWizardExecuteStep<IDeleteBlobDirectoryWizardContext> {
    public priority: number = 100;

    public async execute(wizardContext: IDeleteBlobDirectoryWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {
        const directoryName = nonNullProp(wizardContext, 'dirName');
        const deletingBlobDirectory: string = localize('deletingDirectory', 'Deleting directory "{0}"...', directoryName);
        ext.outputChannel.appendLog(deletingBlobDirectory);
        progress.report({ message: deletingBlobDirectory });
        const errors: boolean = await this.deleteFolder(wizardContext);
        if (errors) {
            ext.outputChannel.appendLog('Please refresh the viewlet to see the changes made.');

            const viewOutput: MessageItem = { title: 'View Errors' };
            const errorMessage: string = `Errors occurred when deleting "${directoryName}".`;
            void window.showWarningMessage(errorMessage, viewOutput).then((result: MessageItem | undefined) => {
                if (result === viewOutput) {
                    ext.outputChannel.show();
                }
            });

            throw new Error(`Errors occurred when deleting "${directoryName}".`);
        }
        const deleteSuccessful: string = localize('successfullyDeletedBlobDirectory', 'Successfully deleted directory "{0}".', directoryName);
        ext.outputChannel.appendLog(deleteSuccessful);

        if (!wizardContext.suppressNotification) {
            void window.showInformationMessage(deleteSuccessful);
        }
    }

    public shouldExecute(): boolean {
        return true;
    }

    private async deleteFolder(context: IDeleteBlobDirectoryWizardContext): Promise<boolean> {
        const blobDirectory = nonNullProp(context, 'blobDirectory');

        const dirPaths: BlobDirectoryTreeItem[] = [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let dirPath: BlobDirectoryTreeItem | undefined = blobDirectory;
        let errors: boolean = false;

        while (dirPath) {
            const children: AzExtTreeItem[] = await dirPath.loadAllChildren(context);
            for (const child of children) {
                if (child instanceof BlobTreeItem) {
                    try {
                        await child.deleteTreeItemImpl(<ISuppressMessageContext>{ ...context, suppressMessage: true });
                    } catch (error) {
                        ext.outputChannel.appendLog(`Cannot delete ${child.blobPath}. ${parseError(error).message}`);
                        errors = true;
                    }
                } else if (child instanceof BlobDirectoryTreeItem) {
                    dirPaths.push(child);
                }
            }

            dirPath = dirPaths.pop();
        }
        return errors;
    }
}
