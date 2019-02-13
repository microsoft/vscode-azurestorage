/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import * as vscode from 'vscode';
import { AzureTreeItem, AzureWizard, createAzureClient, createTreeItemsWithErrorHandling, IActionContext, IStorageAccountWizardContext, ISubscriptionRoot, LocationListStep, ResourceGroupListStep, StorageAccountKind, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { nonNull, StorageAccountWrapper } from '../components/storageWrappers';
import { StorageAccountTreeItem } from './storageAccounts/storageAccountNode';
import { StorageAccountCreateStep } from './wizard/storageAccountCreateStep';
import { StorageAccountNameStep } from './wizard/storageAccountNameStep';

export class StorageAccountProvider extends SubscriptionTreeItem {
    public childTypeLabel: string = "Storage Account";

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzureTreeItem[]> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);

        let accounts = await storageManagementClient.storageAccounts.list();
        return createTreeItemsWithErrorHandling(
            this,
            accounts,
            'invalidStorageAccount',
            async (sa: StorageAccount) => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
            (sa: StorageAccount) => {
                return sa.name;
            }
        );
    }

    // Default value for actionContext stems from https://github.com/Microsoft/vscode-azuretools/issues/120
    public async createChildImpl(showCreatingTreeItem: (label: string) => void, _userOptions: Object, actionContext: IActionContext = <IActionContext>{ properties: {}, measurements: {} }): Promise<AzureTreeItem<ISubscriptionRoot>> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);
        const wizardContext: IStorageAccountWizardContext = Object.assign({}, this.root);

        const wizard = new AzureWizard(
            [new StorageAccountNameStep(), new ResourceGroupListStep(), new LocationListStep()],
            [new StorageAccountCreateStep({ kind: StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS })],
            wizardContext);

        await wizard.prompt(actionContext);

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            showCreatingTreeItem(nonNull(wizardContext.newStorageAccountName));
            progress.report({ message: `Creating storage account '${wizardContext.newStorageAccountName}'` });
            await wizard.execute(actionContext);
        });
        return await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(<StorageAccount>nonNull(wizardContext.storageAccount)), storageManagementClient);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
