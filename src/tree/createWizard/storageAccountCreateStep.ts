/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SkuName, StorageManagementClient } from '@azure/arm-storage';
import { INewStorageAccountDefaults, IStorageAccountWizardContext, LocationListStep, StorageAccountKind, StorageAccountPerformance } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardExecuteStep } from '@microsoft/vscode-azext-utils';
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

        // Edge Zones only support premium storage accounts
        const performance: StorageAccountPerformance = extendedLocation ? StorageAccountPerformance.Premium : this._defaults.performance;
        const newName: string = nonNullProp(wizardContext, 'newStorageAccountName');
        const rgName: string = nonNullProp(nonNullProp(wizardContext, 'resourceGroup'), 'name');
        const newSkuName: SkuName = <SkuName>`${performance}_${this._defaults.replication}`;
        const creatingStorageAccount: string = `Creating storage account "${newName}" in location "${newLocation.name}" with sku "${newSkuName}"...`;
        ext.outputChannel.appendLog(creatingStorageAccount);
        progress.report({ message: creatingStorageAccount });
        const storageClient: StorageManagementClient = await createStorageClient(wizardContext);
        wizardContext.storageAccount = (await storageClient.storageAccounts.beginCreateAndWait(
            rgName,
            newName,
            {
                sku: { name: newSkuName },
                kind: performance === StorageAccountPerformance.Premium ? StorageAccountKind.BlockBlobStorage : this._defaults.kind,
                location,
                extendedLocation,
                enableHttpsTrafficOnly: true
            }
        ));
        const createdStorageAccount: string = `Successfully created storage account "${newName}".`;
        ext.outputChannel.appendLog(createdStorageAccount);
    }

    public shouldExecute(wizardContext: T): boolean {
        return !wizardContext.storageAccount;
    }
}
