/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable-next-line:no-require-imports
import { StorageManagementClient } from 'azure-arm-storage';
import { StorageAccount } from 'azure-arm-storage/lib/models';
import * as vscode from 'vscode';
import { AzExtTreeItem, AzureTreeItem, AzureWizard, AzureWizardPromptStep, createAzureClient, ICreateChildImplContext, IStorageAccountWizardContext, LocationListStep, ResourceGroupListStep, StorageAccountKind, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItemBase } from 'vscode-azureextensionui';
import { nonNull, StorageAccountWrapper } from '../components/storageWrappers';
import { StorageAccountTreeItem } from './storageAccounts/storageAccountNode';
import { StorageAccountCreateStep } from './wizard/storageAccountCreateStep';
import { StorageAccountNameStep } from './wizard/storageAccountNameStep';

export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
    public childTypeLabel: string = "Storage Account";

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);
        let accounts = await storageManagementClient.storageAccounts.list();
        return this.createTreeItemsWithErrorHandling(
            accounts,
            'invalidStorageAccount',
            async (sa: StorageAccount) => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
            (sa: StorageAccount) => {
                return sa.name;
            }
        );
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzureTreeItem> {
        let storageManagementClient = createAzureClient(this.root, StorageManagementClient);
        const wizardContext: IStorageAccountWizardContext = Object.assign(context, this.root);
        const promptSteps: AzureWizardPromptStep<IStorageAccountWizardContext>[] = [new StorageAccountNameStep(), new ResourceGroupListStep()];

        LocationListStep.addStep(wizardContext, promptSteps);

        const wizard = new AzureWizard(wizardContext, {
            title: "Create storage account",
            promptSteps,
            executeSteps: [new StorageAccountCreateStep({ kind: StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS })],
        });

        await wizard.prompt();

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(nonNull(wizardContext.newStorageAccountName));
            progress.report({ message: `Creating storage account '${wizardContext.newStorageAccountName}'` });
            await wizard.execute();
        });
        return await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(<StorageAccount>nonNull(wizardContext.storageAccount)), storageManagementClient);
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }
}
