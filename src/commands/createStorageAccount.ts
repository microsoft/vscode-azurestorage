/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzExtLocation, IStorageAccountWizardContext, LocationListStep, ResourceGroupCreateStep, ResourceGroupListStep, StorageAccountCreateStep, StorageAccountKind, StorageAccountNameStep, StorageAccountPerformance, StorageAccountReplication, VerifyProvidersStep } from '@microsoft/vscode-azext-azureutils';
import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, ICreateChildImplContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { storageProvider } from '../constants';
import { ext } from '../extensionVariables';
import { StaticWebsiteConfigureStep } from '../tree/createWizard/StaticWebsiteConfigureStep';
import { StaticWebsiteEnableStep } from '../tree/createWizard/StaticWebsiteEnableStep';
import { StaticWebsiteErrorDocument404Step } from '../tree/createWizard/StaticWebsiteErrorDocument404Step';
import { StaticWebsiteIndexDocumentStep } from '../tree/createWizard/StaticWebsiteIndexDocumentStep';
import { IStorageAccountTreeItemCreateContext, StorageAccountTreeItemCreateStep } from '../tree/createWizard/StorageAccountTreeItemCreateStep';
import { StorageAccountTreeItem } from '../tree/StorageAccountTreeItem';
import { SubscriptionTreeItem } from '../tree/SubscriptionTreeItem';
import { localize } from '../utils/localize';
import { ISelectStorageAccountContext } from './selectStorageAccountNodeForCommand';

export async function createStorageAccount(context: IActionContext & Partial<ICreateChildImplContext>, treeItem?: SubscriptionTreeItem): Promise<StorageAccountTreeItem> {
    if (!treeItem) {
        treeItem = <SubscriptionTreeItem>await ext.rgApi.appResourceTree.showTreeItemPicker(SubscriptionTreeItem.contextValue, context);
    }

    const wizardContext: IStorageAccountWizardContext = Object.assign(context, treeItem.subscription);
    wizardContext.includeExtendedLocations = true;
    const defaultLocation: string | undefined = wizardContext.isCustomCloud ? undefined : 'westus';
    const promptSteps: AzureWizardPromptStep<IStorageAccountWizardContext>[] = [new StorageAccountNameStep()];
    const executeSteps: AzureWizardExecuteStep<IStorageAccountWizardContext>[] = [
        new StorageAccountCreateStep({ kind: wizardContext.isCustomCloud ? StorageAccountKind.Storage : StorageAccountKind.StorageV2, performance: StorageAccountPerformance.Standard, replication: StorageAccountReplication.LRS }),
        new StorageAccountTreeItemCreateStep(treeItem.subscription),
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
        // context.showCreatingTreeItem(nonNull(wizardContext.newStorageAccountName));
        await wizard.execute();
    });

    // In case this account has been created via a deploy or browse command, the enable website hosting prompt shouldn't be shown
    (<ISelectStorageAccountContext>context).showEnableWebsiteHostingPrompt = false;

    return (<IStorageAccountTreeItemCreateContext>wizardContext).accountTreeItem;
}

export async function createStorageAccountAdvanced(actionContext: IActionContext, treeItem?: SubscriptionTreeItem): Promise<StorageAccountTreeItem> {
    return await createStorageAccount({ ...actionContext, advancedCreation: true }, treeItem);
}
