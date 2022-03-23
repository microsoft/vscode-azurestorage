/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, DialogResponses, IWizardOptions } from "@microsoft/vscode-azext-utils";
import { QuickPickItem } from 'vscode';
import { localize } from "../../utils/localize";
import { IStaticWebsiteConfigWizardContext } from "./IStaticWebsiteConfigWizardContext";
import { StaticWebsiteErrorDocument404Step } from "./StaticWebsiteErrorDocument404Step";
import { StaticWebsiteIndexDocumentStep } from "./StaticWebsiteIndexDocumentStep";

export class StaticWebsiteEnableStep extends AzureWizardPromptStep<IStaticWebsiteConfigWizardContext> {
    public async prompt(context: IStaticWebsiteConfigWizardContext): Promise<void> {
        if (!context.isCustomCloud) {
            const placeHolder: string = localize('wouldYouLikeToEnableStaticWebsiteHosting', 'Would you like to enable static website hosting?');
            const yes: QuickPickItem = { label: DialogResponses.yes.title };
            const no: QuickPickItem = { label: DialogResponses.no.title };

            context.enableStaticWebsite = await context.ui.showQuickPick([yes, no], { placeHolder }) === yes;
        } else {
            context.enableStaticWebsite = false;
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
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
