/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem, IWizardOptions } from "vscode-azureextensionui";
// import { getStaticWebsiteConfig, IStaticWebsiteConfig } from "../../commands/configureStaticWebsite";
import { ext } from "../../extensionVariables";
import { localize } from "../../utils/localize";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";
import { StaticWebsiteErrorDocument404Step } from "./staticWebsiteErrorDocument404Step";
import { StaticWebsiteIndexDocumentStep } from "./staticWebsiteIndexDocumentStep";

export class StaticWebsiteEnableStep extends AzureWizardPromptStep<IStaticWebsiteConfigWizardContext> {
    public async prompt(wizardContext: IStaticWebsiteConfigWizardContext): Promise<void> {
        const placeHolder: string = localize('wouldYouLikeToEnableStaticWebsiteHosting', 'Would you like to enable static website hosting?');
        const picks: IAzureQuickPickItem<string>[] = [
            { label: localize('yes', 'Yes'), data: 'yes' },
            { label: localize('no', 'No'), data: 'no' }
        ];

        wizardContext.enableStaticWebsite = (await ext.ui.showQuickPick(picks, { placeHolder })).data === 'yes';
    }

    public async getSubWizard(wizardContext: IStaticWebsiteConfigWizardContext): Promise<IWizardOptions<IStaticWebsiteConfigWizardContext> | undefined> {
        if (wizardContext.enableStaticWebsite) {
            return {
                promptSteps: [new StaticWebsiteIndexDocumentStep(), new StaticWebsiteErrorDocument404Step()]
            };
        }

        return undefined;
    }

    public shouldPrompt(): boolean {
        return true;
    }
}
