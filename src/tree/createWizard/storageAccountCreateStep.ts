/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import { StorageManagementClient as StackStorageManagementClient, StorageManagementModels as StackStorageManagementModels } from '@azure/arm-storage-profile-2019-03-01-hybrid';
import { Progress } from 'vscode';
import { AzureWizardExecuteStep, INewStorageAccountDefaults, IStorageAccountWizardContext } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { createStorageClientResult } from '../../utils/clientManagementUtil';

export class StorageAccountCreateStep<T extends IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> implements StorageAccountCreateStep<T> {
    public priority: number = 130;

    private readonly _defaults: INewStorageAccountDefaults;

    public constructor(defaults: INewStorageAccountDefaults) {
        super();
        this._defaults = defaults;
    }

    public async execute(wizardContext: T, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        // tslint:disable-next-line:no-non-null-assertion
        const newLocation: string = wizardContext.location!.name!;
        // tslint:disable-next-line:no-non-null-assertion
        const newName: string = wizardContext.newStorageAccountName!;
        let storageManagementResult = await createStorageClientResult(wizardContext, false);
        let storageClient: StorageManagementClient | StackStorageManagementClient;
        let newSkuName: StackStorageManagementModels.SkuName | StorageManagementModels.SkuName;
        let wizardStorageAccount: StorageManagementModels.StorageAccount | StackStorageManagementModels.StorageAccount;
        if (storageManagementResult.isAzureStack) {
            storageClient = <StackStorageManagementClient>storageManagementResult.clinet;
            newSkuName = <StackStorageManagementModels.SkuName>`${this._defaults.performance}_${this._defaults.replication}`;
            this.messageCreatingStorageAccount(newName, newLocation, newSkuName, progress);
            let stackStorageCreateParams = {
                sku: { name: newSkuName },
                kind: this._defaults.kind,
                location: newLocation,
                enableHttpsTrafficOnly: true
            };
            wizardStorageAccount = await storageClient.storageAccounts.create(
                // tslint:disable-next-line:no-non-null-assertion
                wizardContext.resourceGroup!.name!,
                newName,
                stackStorageCreateParams
            );
        } else {
            storageClient = <StorageManagementClient>storageManagementResult.clinet;
            newSkuName = <StorageManagementModels.SkuName>`${this._defaults.performance}_${this._defaults.replication}`;
            this.messageCreatingStorageAccount(newName, newLocation, newSkuName, progress);
            let storageCreateParams = {
                sku: { name: newSkuName },
                kind: this._defaults.kind,
                location: newLocation,
                enableHttpsTrafficOnly: true
            };
            wizardStorageAccount = await storageClient.storageAccounts.create(
                // tslint:disable-next-line:no-non-null-assertion
                wizardContext.resourceGroup!.name!,
                newName,
                storageCreateParams
            );
        }
        // Also change type in extensionui to make wizardContext.StorageAccount support stack api-version.
        // tslint:disable-next-line: no-unsafe-any
        wizardContext.storageAccount = <StorageManagementModels.StorageAccount>wizardStorageAccount;
        const createdStorageAccount: string = `Successfully created storage account "${newName}".`;
        ext.outputChannel.appendLog(createdStorageAccount);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.storageAccount;
    }

    private messageCreatingStorageAccount(newName: string, newLocation: string, newSkuName: StackStorageManagementModels.SkuName | StorageManagementModels.SkuName, progress: Progress<{ message?: string; increment?: number }>
    ): void {
        const creatingStorageAccount: string = `Creating storage account "${newName}" in location "${newLocation}" with sku "${newSkuName}"...`;
        ext.outputChannel.appendLog(creatingStorageAccount);
        progress.report({ message: creatingStorageAccount });
    }
}
