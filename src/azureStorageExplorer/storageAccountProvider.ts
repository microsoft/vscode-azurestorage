/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import * as vscode from 'vscode';
import { AzureTreeItem, AzureWizard, createAzureClient, createTreeItemsWithErrorHandling, IActionContext, IStorageAccountWizardContext, ISubscriptionRoot, LocationListStep, ResourceGroupListStep, StorageAccountCreateStep, StorageAccountKind, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItem } from 'vscode-azureextensionui';
import { StorageAccountWrapper } from '../components/storageWrappers';
import { StorageAccountTreeItem } from './storageAccounts/storageAccountNode';
import { StorageAccountNameStep } from 'vscode-azureextensionui';

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

    public async createChildImpl(showCreatingTreeItem: (label: string) => void, _userOptions: Object, actionContext?: IActionContext): Promise<AzureTreeItem<ISubscriptionRoot>> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);
        const wizardContext: IStorageAccountWizardContext = Object.assign({}, this.root);

        const wizard = new AzureWizard(
            [new ResourceGroupListStep(), new LocationListStep(), new StorageAccountNameStep()],
            [new StorageAccountCreateStep({ kind: StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS })],
            wizardContext);

        // https://github.com/Microsoft/vscode-azuretools/issues/120
        actionContext = actionContext ? actionContext : <IActionContext>{ properties: {}, measurements: {} };

        await wizard.prompt(actionContext);

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            // tslint:disable-next-line:no-non-null-assertion
            showCreatingTreeItem(wizardContext.newStorageAccountName!);
            progress.report({ message: `Storage: Creating account '${wizardContext.newStorageAccountName}'` });
            // tslint:disable-next-line:no-non-null-assertion
            await wizard.execute(actionContext!);
        });
        let accountArray: AzureTreeItem[] = await createTreeItemsWithErrorHandling(
            this,
            [wizardContext.storageAccount],
            'invalidStorageAccount',
            async (sa: StorageAccount) => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
            (sa: StorageAccount) => sa.name
        );
        return accountArray[0];
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
