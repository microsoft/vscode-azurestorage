/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AzExtTreeItem, AzureTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, ICreateChildImplContext, IStorageAccountWizardContext, LocationListStep, ResourceGroupCreateStep, ResourceGroupListStep, StorageAccountKind, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItemBase, VerifyProvidersStep } from 'vscode-azureextensionui';
import { ISelectStorageAccountContext } from '../commands/selectStorageAccountNodeForCommand';
import { createStorageClient } from '../utils/azureClients';
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
        try {
            let storageManagementClient = await createStorageClient(this.root);
            let accounts = await storageManagementClient.storageAccounts.list();
            return this.createTreeItemsWithErrorHandling(
                accounts,
                'invalidStorageAccount',
                async sa => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
                sa => sa.name
            );
        } catch (error) {
            throw error;
        }
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzureTreeItem> {
        let isStack = this.root.environment.name === "AzurePPE" ? true : false;
        const wizardContext: IStorageAccountWizardContext = Object.assign(context, this.root);
        let stackLocation = (await LocationListStep.getLocations(wizardContext)).find(l => l.displayName !== undefined || l.name !== undefined);
        let defaultStackLocation: string;
        if (stackLocation === undefined) {
            throw new Error("there is no available location for resource provider in azure stack");
        } else {
            defaultStackLocation = <string>(stackLocation.name !== undefined ? stackLocation.name : stackLocation.displayName);
        }
        const defaultLocation: string = isStack ? defaultStackLocation : 'westus';
        const promptSteps: AzureWizardPromptStep<IStorageAccountWizardContext>[] = [new StorageAccountNameStep()];
        const executeSteps: AzureWizardExecuteStep<IStorageAccountWizardContext>[] = [
            new StorageAccountCreateStep({ kind: isStack ? StorageAccountKind.Storage : StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS }),
            new StorageAccountTreeItemCreateStep(this),
            new StaticWebsiteConfigureStep(),
            new VerifyProvidersStep(['Microsoft.Storage'])
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

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async () => {
            context.showCreatingTreeItem(nonNull(wizardContext.newStorageAccountName));
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
