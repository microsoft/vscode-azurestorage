/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CheckNameAvailabilityResult, StorageManagementClient } from '@azure/arm-storage';
import { IStorageAccountWizardContext, ResourceGroupListStep, resourceGroupNamingRules, storageAccountNamingRules } from '@microsoft/vscode-azext-azureutils';
import { AzureNameStep } from '@microsoft/vscode-azext-utils';
import { createStorageClient } from '../../utils/azureClients';

export class StorageAccountNameStep<T extends IStorageAccountWizardContext> extends AzureNameStep<T> {
    public async prompt(context: T): Promise<void> {
        const client: StorageManagementClient = await createStorageClient(context);

        const suggestedName: string | undefined = context.relatedNameTask ? await context.relatedNameTask : undefined;
        context.newStorageAccountName = (await context.ui.showInputBox({
            value: suggestedName,
            prompt: 'Enter a globally unique name for the new Storage Account',
            validateInput: async (value: string): Promise<string | undefined> => await this.validateStorageAccountName(client, value)
        })).trim();
        context.valuesToMask.push(context.newStorageAccountName);
        if (!context.relatedNameTask) {
            context.relatedNameTask = this.generateRelatedName(context, context.newStorageAccountName, resourceGroupNamingRules);
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
            const nameAvailabilityResult: CheckNameAvailabilityResult = await client.storageAccounts.checkNameAvailability({ name, type: 'Microsoft.Storage/storageAccounts' });
            if (!nameAvailabilityResult.nameAvailable) {
                return nameAvailabilityResult.message;
            } else {
                return undefined;
            }
        }
    }
}
