/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageManagementClient, StorageManagementModels } from '@azure/arm-storage';
import { StorageManagementClient as StorageManagementClient1 } from '@azure/arm-storage1';
import { AzureNameStep, createAzureClient, IStorageAccountWizardContext, ResourceGroupListStep, resourceGroupNamingRules, storageAccountNamingRules } from 'vscode-azureextensionui';
import { ext } from '../../extensionVariables';
import { ifStack } from '../../utils/environmentUtils';

export class StorageAccountNameStep<T extends IStorageAccountWizardContext> extends AzureNameStep<T> {
    public async prompt(wizardContext: T): Promise<void> {
        let client: StorageManagementClient;
        let isAzureStack: boolean = ifStack();
        if (isAzureStack) {
            client = createAzureClient(wizardContext, StorageManagementClient1);
        } else {
            client = createAzureClient(wizardContext, StorageManagementClient);
        }

        const suggestedName: string | undefined = wizardContext.relatedNameTask ? await wizardContext.relatedNameTask : undefined;
        wizardContext.newStorageAccountName = (await ext.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter a globally unique name for the new Storage Account',
            validateInput: async (value: string): Promise<string | undefined> => await this.validateStorageAccountName(client, value)
        })).trim();

        if (!wizardContext.relatedNameTask) {
            wizardContext.relatedNameTask = this.generateRelatedName(wizardContext, wizardContext.newStorageAccountName, resourceGroupNamingRules);
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.newStorageAccountName;
    }

    protected async isRelatedNameAvailable(wizardContext: T, name: string): Promise<boolean> {
        return await ResourceGroupListStep.isNameAvailable(wizardContext, name);
    }

    private async validateStorageAccountName(client: StorageManagementClient, name: string): Promise<string | undefined> {
        name = name ? name.trim() : '';

        if (!name || name.length < storageAccountNamingRules.minLength || name.length > storageAccountNamingRules.maxLength) {
            return `The name must be between ${storageAccountNamingRules.minLength} and ${storageAccountNamingRules.maxLength} characters.`;
        } else if (name.match(storageAccountNamingRules.invalidCharsRegExp) !== null) {
            return "The name can only contain lowercase letters and numbers.";
        } else {
            const nameAvailabilityResult: StorageManagementModels.CheckNameAvailabilityResult = await client.storageAccounts.checkNameAvailability(name);
            if (!nameAvailabilityResult.nameAvailable) {
                return nameAvailabilityResult.message;
            } else {
                return undefined;
            }
        }
    }
}
