/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import { AzureWizardExecuteStep, INewStorageAccountDefaults, IStorageAccountWizardContext, LocationListStep } from 'vscode-azureextensionui';
import { NotificationProgress, storageProvider } from '../../constants';
import { ext } from '../../extensionVariables';
import { createStorageClient } from '../../utils/azureClients';
import { nonNullProp } from '../../utils/nonNull';

export class StorageAccountCreateStep<T extends IStorageAccountWizardContext> extends AzureWizardExecuteStep<T> implements StorageAccountCreateStep<T> {
    public priority: number = 130;

    private readonly _defaults: INewStorageAccountDefaults;

    public constructor(defaults: INewStorageAccountDefaults) {
        super();
        this._defaults = defaults;
    }

    public async execute(wizardContext: T, progress: NotificationProgress): Promise<void> {
        const newLocation = await LocationListStep.getLocation(wizardContext, storageProvider, true);
        const { location, extendedLocation } = LocationListStep.getExtendedLocation(newLocation);

        const newName: string = nonNullProp(wizardContext, 'newStorageAccountName');
        const rgName: string = nonNullProp(nonNullProp(wizardContext, 'resourceGroup'), 'name');
        const newSkuName: StorageManagementModels.SkuName = <StorageManagementModels.SkuName>`${this._defaults.performance}_${this._defaults.replication}`;
        const creatingStorageAccount: string = `Creating storage account "${newName}" in location "${newLocation.name}" with sku "${newSkuName}"...`;
        ext.outputChannel.appendLog(creatingStorageAccount);
        progress.report({ message: creatingStorageAccount });
        const storageClient: StorageManagementClient = await createStorageClient(wizardContext);
        wizardContext.storageAccount = await storageClient.storageAccounts.create(
            rgName,
            newName,
            {
                sku: { name: newSkuName },
                kind: this._defaults.kind,
                // TODO: getting error 'Supplied location westus is not valid.'. This code seems to work for VMs, though
                location,
                extendedLocation,
                enableHttpsTrafficOnly: true
            }
        );
        const createdStorageAccount: string = `Successfully created storage account "${newName}".`;
        ext.outputChannel.appendLog(createdStorageAccount);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.storageAccount;
    }
}
