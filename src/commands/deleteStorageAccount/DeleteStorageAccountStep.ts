/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardExecuteStep, nonNullProp } from "@microsoft/vscode-azext-utils";
import { Progress, window } from "vscode";
import { ext } from "../../extensionVariables";
import { StorageAccountTreeItem } from "../../tree/StorageAccountTreeItem";
import { createStorageClient } from "../../utils/azureClients";
import { localize } from "../../utils/localize";
import { DeleteStorageAccountWizardContext } from "./DeleteStorageAccountWizardContext";

export class DeleteStorageAccountStep extends AzureWizardExecuteStep<DeleteStorageAccountWizardContext>  {
    public priority: number = 100;

    public async execute(wizardContext: DeleteStorageAccountWizardContext, progress: Progress<{ message?: string | undefined; increment?: number | undefined; }>): Promise<void> {

        const storageAccount = nonNullProp(wizardContext, 'storageAccount');

        const deletingStorageAccount: string = localize('deletingStorageAccount', 'Deleting storage account "{0}"...', storageAccount.name);
        const storageManagementClient = await createStorageClient([wizardContext, wizardContext.subscription]);
        const parsedId = StorageAccountTreeItem.parseAzureResourceId(storageAccount.id);
        const resourceGroupName = parsedId.resourceGroups;

        ext.outputChannel.appendLog(deletingStorageAccount);
        progress.report({ message: deletingStorageAccount });
        await storageManagementClient.storageAccounts.delete(resourceGroupName, storageAccount.name);

        const deleteSuccessful: string = localize('successfullyDeletedStorageAccount', 'Successfully deleted storage account "{0}".', storageAccount.name);
        ext.outputChannel.appendLog(deleteSuccessful);
        void window.showInformationMessage(deleteSuccessful);
    }

    public shouldExecute(): boolean {
        return true;
    }
}
