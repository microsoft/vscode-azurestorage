/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep } from "@microsoft/vscode-azext-utils";
import { localize } from "../../../utils/localize";
import { IFileShareWizardContext } from "./IFileShareWizardContext";

const minQuotaGB = 1;
const maxQuotaGB = 5120;

export class StorageQuotaPromptStep extends AzureWizardPromptStep<IFileShareWizardContext> {
    public async prompt(context: IFileShareWizardContext): Promise<void> {
        context.quota = Number(await context.ui.showInputBox({
            prompt: localize('quotaPrompt', 'Specify quota (in GB, between {0} and {1}), to limit total storage size', minQuotaGB, maxQuotaGB),
            value: maxQuotaGB.toString(),
            validateInput: this.validateQuota
        }));
    }

    public shouldPrompt(context: IFileShareWizardContext): boolean {
        return !context.quota;
    }

    private validateQuota(input: string): string | undefined {
        const value = Number(input);
        if (isNaN(value)) {
            return localize('quotaNum', 'Value must be a number');
        } else if (value < minQuotaGB || value > maxQuotaGB) {
            return localize('quotaBetween', 'Value must be between {0} and {1}', minQuotaGB, maxQuotaGB);
        }

        return undefined;
    }
}
