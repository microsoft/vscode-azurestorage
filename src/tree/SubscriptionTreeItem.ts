/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { StorageAccount as StackStorageAccount, StorageAccountListResult as StackStorageAccountListResult } from '@azure/arm-storage-profile-2019-03-01-hybrid/esm/models';
import { StorageAccount, StorageAccountListResult } from '@azure/arm-storage/esm/models';
import * as vscode from 'vscode';
import { AzExtTreeItem, AzureTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, ICreateChildImplContext, IStorageAccountWizardContext, LocationListStep, ResourceGroupCreateStep, ResourceGroupListStep, StorageAccountKind, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItemBase } from 'vscode-azureextensionui';
import { ISelectStorageAccountContext } from '../commands/selectStorageAccountNodeForCommand';
import { createStorageClientResult } from '../utils/clientManagementUtil';
import { ifStack } from '../utils/environmentUtils';
import { nonNull, StorageAccountWrapper } from '../utils/storageWrappers';
import { AttachedStorageAccountTreeItem } from './AttachedStorageAccountTreeItem';
import { StaticWebsiteConfigureStep } from './createWizard/StaticWebsiteConfigureStep';
import { StaticWebsiteEnableStep } from './createWizard/StaticWebsiteEnableStep';
import { StaticWebsiteErrorDocument404Step } from './createWizard/StaticWebsiteErrorDocument404Step';
import { StaticWebsiteIndexDocumentStep } from './createWizard/StaticWebsiteIndexDocumentStep';
import { StorageAccountCreateStep } from './createWizard/storageAccountCreateStep';
import { StorageAccountNameStep } from './createWizard/storageAccountNameStep';
import { IStorageAccountTreeItemCreateContext, StorageAccountTreeItemCreateStep } from './createWizard/StorageAccountTreeItemCreateStep';
import { StorageAccountTreeItem } from './StorageAccountTreeItem';

export class SubscriptionTreeItem extends SubscriptionTreeItemBase {
    public childTypeLabel: string = "Storage Account";
    public supportsAdvancedCreation: boolean = true;

    async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        let clientResult = await createStorageClientResult(this.root, true);
        let storageManagementClient = clientResult.client;
        let accounts: StorageAccountListResult | StackStorageAccountListResult = await storageManagementClient.storageAccounts.list();
        return this.createTreeItemsWithErrorHandling<StorageAccount | StackStorageAccount>(
            accounts,
            'invalidStorageAccount',
            async sa => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
            sa => (sa).name
        );
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzureTreeItem> {
        const isStack = ifStack();
        const defaultLocation = isStack ? 'local' : 'westus';
        const wizardContext: IStorageAccountWizardContext = Object.assign(context, this.root);
        const promptSteps: AzureWizardPromptStep<IStorageAccountWizardContext>[] = [new StorageAccountNameStep()];
        const executeSteps: AzureWizardExecuteStep<IStorageAccountWizardContext>[] = [
            isStack ?
                new StorageAccountCreateStep({ kind: StorageAccountKind.Storage, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS }) :
                new StorageAccountCreateStep({ kind: StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS }),
            new StorageAccountTreeItemCreateStep(this),
            new StaticWebsiteConfigureStep()
        ];

        if (context.advancedCreation) {
            promptSteps.push(new ResourceGroupListStep());
            promptSteps.push(new StaticWebsiteEnableStep(isStack));
            LocationListStep.addStep(wizardContext, promptSteps);
        } else {
            executeSteps.push(new ResourceGroupCreateStep());
            Object.assign(wizardContext, {
                enableStaticWebsite: isStack ? false : true,
                indexDocument: isStack ? "" : StaticWebsiteIndexDocumentStep.defaultIndexDocument,
                errorDocument404Path: isStack ? "" : StaticWebsiteErrorDocument404Step.defaultErrorDocument404Path
            });
            await LocationListStep.setLocation(wizardContext, defaultLocation);
        }

        const wizard = new AzureWizard(wizardContext, {
            title: "Create storage account",
            promptSteps,
            executeSteps
        });

        await wizard.prompt();

        if (!context.advancedCreation) {
            wizardContext.newResourceGroupName = await wizardContext.relatedNameTask;
        }

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async (progress) => {
            context.showCreatingTreeItem(nonNull(wizardContext.newStorageAccountName));
            progress.report({ message: `Creating storage account '${wizardContext.newStorageAccountName}'` });
            await wizard.execute();
        });

        // In case this account has been created via a deploy or browse command, the enable website hosting prompt shouldn't be shown
        (<ISelectStorageAccountContext>context).showEnableWebsiteHostingPrompt = false;

        return (<IStorageAccountTreeItemCreateContext>wizardContext).accountTreeItem;
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue !== AttachedStorageAccountTreeItem.baseContextValue && contextValue !== AttachedStorageAccountTreeItem.emulatedContextValue;
    }
}
