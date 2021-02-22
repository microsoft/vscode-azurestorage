/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem } from 'vscode';
import { AzureWizardPromptStep, DialogResponses, IWizardOptions } from "vscode-azureextensionui";
import { ext } from "../../extensionVariables";
import { localize } from "../../utils/localize";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";
import { StaticWebsiteErrorDocument404Step } from "./StaticWebsiteErrorDocument404Step";
import { StaticWebsiteIndexDocumentStep } from "./StaticWebsiteIndexDocumentStep";

export class StaticWebsiteEnableStep extends AzureWizardPromptStep<IStaticWebsiteConfigWizardContext> {
    public async prompt(wizardContext: IStaticWebsiteConfigWizardContext): Promise<void> {
        if (!wizardContext.isCustomCloud) {
            const placeHolder: string = localize('wouldYouLikeToEnableStaticWebsiteHosting', 'Would you like to enable static website hosting?');
            const yes: QuickPickItem = { label: DialogResponses.yes.title };
            const no: QuickPickItem = { label: DialogResponses.no.title };

            wizardContext.enableStaticWebsite = await ext.ui.showQuickPick([yes, no], { placeHolder }) === yes;
        } else {
            wizardContext.enableStaticWebsite = false;
        }
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
