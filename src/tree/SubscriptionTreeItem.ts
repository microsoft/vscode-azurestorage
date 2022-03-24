/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageAccount, StorageManagementClient } from '@azure/arm-storage';
import { AzExtLocation, IStorageAccountWizardContext, LocationListStep, ResourceGroupCreateStep, ResourceGroupListStep, StorageAccountKind, StorageAccountPerformance, StorageAccountReplication, SubscriptionTreeItemBase, uiUtils, VerifyProvidersStep } from '@microsoft/vscode-azext-azureutils';
import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, ICreateChildImplContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ISelectStorageAccountContext } from '../commands/selectStorageAccountNodeForCommand';
import { storageProvider } from '../constants';
import { createStorageClient } from '../utils/azureClients';
import { localize } from '../utils/localize';
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

    private _nextLink: string | undefined;

    async loadMoreChildrenImpl(clearCache: boolean, context: IActionContext): Promise<AzExtTreeItem[]> {
        if (clearCache) {
            this._nextLink = undefined;
        }

        const storageManagementClient: StorageManagementClient = await createStorageClient([context, this]);
        const accounts: StorageAccount[] = await uiUtils.listAllIterator(storageManagementClient.storageAccounts.list());

        return this.createTreeItemsWithErrorHandling(
            accounts,
            'invalidStorageAccount',
            async sa => await StorageAccountTreeItem.createStorageAccountTreeItem(this, new StorageAccountWrapper(sa), storageManagementClient),
            sa => sa.name
        );
    }

    public async createChildImpl(context: ICreateChildImplContext): Promise<AzExtTreeItem> {
        const wizardContext: IStorageAccountWizardContext = Object.assign(context, this.subscription);
        wizardContext.includeExtendedLocations = true;
        const defaultLocation: string | undefined = wizardContext.isCustomCloud ? undefined : 'westus';
        const promptSteps: AzureWizardPromptStep<IStorageAccountWizardContext>[] = [new StorageAccountNameStep()];
        const executeSteps: AzureWizardExecuteStep<IStorageAccountWizardContext>[] = [
            new StorageAccountCreateStep({ kind: wizardContext.isCustomCloud ? StorageAccountKind.Storage : StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS }),
            new StorageAccountTreeItemCreateStep(this),
            new StaticWebsiteConfigureStep(),
            new VerifyProvidersStep([storageProvider])
        ];
        LocationListStep.addProviderForFiltering(wizardContext, storageProvider, 'storageAccounts');

        if (context.advancedCreation) {
            promptSteps.push(new ResourceGroupListStep());
            promptSteps.push(new StaticWebsiteEnableStep());
            LocationListStep.addStep(wizardContext, promptSteps);
            LocationListStep.getQuickPickDescription = (location: AzExtLocation) => {
                return location.metadata?.regionCategory === 'Extended' ? localize('onlyPremiumSupported', 'Only supports Premium storage accounts') : undefined;
            }
        } else {
            executeSteps.push(new ResourceGroupCreateStep());
            Object.assign(wizardContext, {
                enableStaticWebsite: wizardContext.isCustomCloud ? false : true,
                indexDocument: wizardContext.isCustomCloud ? "" : StaticWebsiteIndexDocumentStep.defaultIndexDocument,
                errorDocument404Path: wizardContext.isCustomCloud ? "" : StaticWebsiteErrorDocument404Step.defaultErrorDocument404Path
            });
            if (defaultLocation) {
                await LocationListStep.setLocation(wizardContext, defaultLocation);
            } else {
                LocationListStep.addStep(wizardContext, promptSteps);
            }
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
        return !!this._nextLink;
    }

    public isAncestorOfImpl(contextValue: string): boolean {
        return contextValue !== AttachedStorageAccountTreeItem.baseContextValue && contextValue !== AttachedStorageAccountTreeItem.emulatedContextValue;
    }
}
